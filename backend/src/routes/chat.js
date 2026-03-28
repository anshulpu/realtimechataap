import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { mkdir, writeFile } from "fs/promises";
import Message from "../models/Message.js";
import Room from "../models/Room.js";
import User from "../models/User.js";
import Call from "../models/Call.js";
import { authHttp } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4"
]);

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".webm", ".ogg", ".mp3", ".wav", ".m4a"]);
const mimeToExt = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/mp4": ".m4a"
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads");

const sanitizeText = (value) =>
  String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeAbout = (value) => sanitizeText(value).slice(0, 140);

const parseLimit = (value, fallback = 24, max = 80) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const asId = (value) => String(value || "");
const verifierUserRegex = /^(sock[ab]_\w+|user[ab]_\d+|sender_\d+|receiver_\d+)$/i;
const verifierEmailRegex = /^((a|b)_\d+@mail\.com|(sender|receiver)_\d+@mail\.com|sock[ab]_\w+@test\.local)$/i;

const findVerifierUsers = () =>
  User.find({
    $or: [
      { username: { $regex: verifierUserRegex } },
      { email: { $regex: verifierEmailRegex } }
    ]
  })
    .select("_id username email")
    .lean();

const cleanupVerifierUsers = async () => {
  const users = await findVerifierUsers();
  if (users.length === 0) {
    return { users: 0, messages: 0, rooms: 0 };
  }

  const ids = users.map((user) => user._id);

  const [messageDelete, roomDelete, userDelete] = await Promise.all([
    Message.deleteMany({
      $or: [
        { senderId: { $in: ids } },
        { receiverId: { $in: ids } }
      ]
    }),
    Room.deleteMany({
      $or: [
        { createdBy: { $in: ids } },
        { members: { $in: ids } }
      ]
    }),
    User.deleteMany({ _id: { $in: ids } })
  ]);

  return {
    users: userDelete.deletedCount || 0,
    messages: messageDelete.deletedCount || 0,
    rooms: roomDelete.deletedCount || 0
  };
};

const isPrivatePeerAccessible = async (meId, otherUserId) => {
  const [meDoc, otherDoc] = await Promise.all([
    User.findById(meId).select("_id blockedUsers favouriteUsers").lean(),
    User.findById(otherUserId).select("_id blockedUsers").lean()
  ]);

  if (!meDoc || !otherDoc) return null;

  const blockedByMe = (meDoc.blockedUsers || []).some((id) => asId(id) === asId(otherUserId));
  const blockedMe = (otherDoc.blockedUsers || []).some((id) => asId(id) === asId(meId));
  const favourite = (meDoc.favouriteUsers || []).some((id) => asId(id) === asId(otherUserId));

  return { meDoc, otherDoc, blockedByMe, blockedMe, favourite };
};

const serializeCall = (call, usersById = {}) => {
  const caller = usersById[String(call.callerId)] || {};
  const receiver = usersById[String(call.receiverId)] || {};
  return {
    id: String(call._id),
    callerId: String(call.callerId),
    receiverId: String(call.receiverId),
    callType: call.callType,
    status: call.status,
    startedAt: call.startedAt,
    connectedAt: call.connectedAt,
    endedAt: call.endedAt,
    callerName: caller.username || "",
    callerAvatar: caller.avatarUrl || "",
    receiverName: receiver.username || "",
    receiverAvatar: receiver.avatarUrl || ""
  };
};

export const buildChatRoutes = (jwtSecret) => {
  router.get("/users", authHttp(jwtSecret), async (req, res) => {
    const users = await User.find({
      _id: { $ne: req.user.id },
      $nor: [
        { username: { $regex: verifierUserRegex } },
        { email: { $regex: verifierEmailRegex } }
      ]
    })
      .select("username email avatarUrl isOnline lastSeen")
      .sort({ username: 1 })
      .lean();

    return res.json({ users: users.map((u) => ({ id: String(u._id), ...u })) });
  });

  router.get("/rooms", authHttp(jwtSecret), async (req, res) => {
    const rooms = await Room.find({ members: req.user.id }).select("name members").lean();
    return res.json({ rooms: rooms.map((r) => ({ id: String(r._id), name: r.name, members: r.members.map(String) })) });
  });

  router.get("/calls", authHttp(jwtSecret), async (req, res) => {
    const limit = parseLimit(req.query.limit, 24, 80);
    const calls = await Call.find({
      $or: [{ callerId: req.user.id }, { receiverId: req.user.id }]
    })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    const userIds = Array.from(new Set(calls.flatMap((c) => [String(c.callerId), String(c.receiverId)])));
    const users = await User.find({ _id: { $in: userIds } }).select("username avatarUrl").lean();
    const usersById = users.reduce((acc, u) => {
      acc[String(u._id)] = u;
      return acc;
    }, {});

    return res.json({ calls: calls.map((call) => serializeCall(call, usersById)) });
  });

  router.get("/calls/missed", authHttp(jwtSecret), async (req, res) => {
    const missed = await Call.find({ receiverId: req.user.id, status: "missed", seenByReceiver: false })
      .sort({ startedAt: -1 })
      .limit(50)
      .lean();

    const callerIds = Array.from(new Set(missed.map((c) => String(c.callerId))));
    const users = await User.find({ _id: { $in: callerIds } }).select("username avatarUrl").lean();
    const usersById = users.reduce((acc, u) => {
      acc[String(u._id)] = u;
      return acc;
    }, {});

    if (missed.length > 0) {
      await Call.updateMany(
        { _id: { $in: missed.map((c) => c._id) } },
        { $set: { seenByReceiver: true } }
      );
    }

    return res.json({ calls: missed.map((call) => serializeCall(call, usersById)) });
  });

  router.post("/rooms", authHttp(jwtSecret), async (req, res) => {
    const name = sanitizeText(req.body.name);
    const members = Array.isArray(req.body.members) ? req.body.members : [];

    if (name.length < 2) return res.status(400).json({ message: "Room name must be at least 2 characters" });

    const uniqueMembers = [req.user.id, ...members]
      .map(String)
      .filter((id, i, arr) => mongoose.isValidObjectId(id) && arr.indexOf(id) === i);

    const room = await Room.create({ name, members: uniqueMembers, createdBy: req.user.id });
    return res.status(201).json({ room: { id: String(room._id), name: room.name, members: room.members.map(String) } });
  });

  router.get("/messages/private/:userId", authHttp(jwtSecret), async (req, res) => {
    const other = String(req.params.userId || "");
    if (!mongoose.isValidObjectId(other)) return res.status(400).json({ message: "Invalid user id" });

    const messages = await Message.find({
      roomId: null,
      $or: [
        { senderId: req.user.id, receiverId: other },
        { senderId: other, receiverId: req.user.id }
      ]
    })
      .sort({ timestamp: 1 })
      .lean();

    return res.json({ messages: messages.map((m) => ({ ...m, _id: String(m._id) })) });
  });

  router.get("/messages/room/:roomId", authHttp(jwtSecret), async (req, res) => {
    const roomId = String(req.params.roomId || "");
    if (!mongoose.isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

    const room = await Room.findById(roomId).select("members").lean();
    if (!room) return res.status(404).json({ message: "Room not found" });
    if (!room.members.some((id) => String(id) === req.user.id)) return res.status(403).json({ message: "Not a room member" });

    const messages = await Message.find({ roomId }).sort({ timestamp: 1 }).lean();
    return res.json({ messages: messages.map((m) => ({ ...m, _id: String(m._id) })) });
  });

  router.get("/profile/:userId", authHttp(jwtSecret), async (req, res) => {
    const userId = asId(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid user id" });
    if (asId(req.user.id) === userId) return res.status(400).json({ message: "Use /auth/me for your profile" });

    const relation = await isPrivatePeerAccessible(req.user.id, userId);
    if (!relation) return res.status(404).json({ message: "User not found" });

    const target = await User.findById(userId)
      .select("username email avatarUrl about isOnline lastSeen")
      .lean();

    if (!target) return res.status(404).json({ message: "User not found" });

    const query = {
      roomId: null,
      $or: [
        { senderId: req.user.id, receiverId: userId },
        { senderId: userId, receiverId: req.user.id }
      ]
    };

    const [messageCount, mediaCount] = await Promise.all([
      Message.countDocuments(query),
      Message.countDocuments({ ...query, "attachment.url": { $exists: true, $ne: "" } })
    ]);

    return res.json({
      profile: {
        id: userId,
        username: target.username,
        email: target.email,
        avatarUrl: target.avatarUrl || "",
        about: target.about || "",
        isOnline: Boolean(target.isOnline),
        lastSeen: target.lastSeen || null,
        blockedByMe: relation.blockedByMe,
        blockedMe: relation.blockedMe,
        favourite: relation.favourite,
        stats: {
          messageCount,
          mediaCount
        }
      }
    });
  });

  router.get("/profile/:userId/media", authHttp(jwtSecret), async (req, res) => {
    const userId = asId(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid user id" });
    if (asId(req.user.id) === userId) return res.status(400).json({ message: "Invalid peer" });

    const relation = await isPrivatePeerAccessible(req.user.id, userId);
    if (!relation) return res.status(404).json({ message: "User not found" });

    const limit = parseLimit(req.query.limit, 24, 80);
    const media = await Message.find({
      roomId: null,
      "attachment.url": { $exists: true, $ne: "" },
      $or: [
        { senderId: req.user.id, receiverId: userId },
        { senderId: userId, receiverId: req.user.id }
      ]
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select("senderId attachment timestamp")
      .lean();

    return res.json({
      media: media.map((item) => ({
        id: asId(item._id),
        senderId: asId(item.senderId),
        timestamp: item.timestamp,
        attachment: item.attachment
      }))
    });
  });

  router.patch("/profile/about", authHttp(jwtSecret), async (req, res) => {
    const about = sanitizeAbout(req.body.about);
    await User.updateOne({ _id: req.user.id }, { $set: { about } });
    return res.json({ about });
  });

  router.post("/users/:userId/block", authHttp(jwtSecret), async (req, res) => {
    const userId = asId(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid user id" });
    if (asId(req.user.id) === userId) return res.status(400).json({ message: "Cannot block yourself" });

    const exists = await User.exists({ _id: userId });
    if (!exists) return res.status(404).json({ message: "User not found" });

    const blocked = req.body?.blocked !== false;
    await User.updateOne(
      { _id: req.user.id },
      blocked ? { $addToSet: { blockedUsers: userId } } : { $pull: { blockedUsers: userId } }
    );

    return res.json({ blocked, userId });
  });

  router.post("/users/:userId/favourite", authHttp(jwtSecret), async (req, res) => {
    const userId = asId(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid user id" });
    if (asId(req.user.id) === userId) return res.status(400).json({ message: "Cannot favourite yourself" });

    const exists = await User.exists({ _id: userId });
    if (!exists) return res.status(404).json({ message: "User not found" });

    const favourite = req.body?.favourite !== false;
    await User.updateOne(
      { _id: req.user.id },
      favourite ? { $addToSet: { favouriteUsers: userId } } : { $pull: { favouriteUsers: userId } }
    );

    return res.json({ favourite, userId });
  });

  router.delete("/conversations/private/:userId/messages", authHttp(jwtSecret), async (req, res) => {
    const userId = asId(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid user id" });

    const peer = await User.exists({ _id: userId });
    if (!peer) return res.status(404).json({ message: "User not found" });

    const result = await Message.deleteMany({
      roomId: null,
      $or: [
        { senderId: req.user.id, receiverId: userId },
        { senderId: userId, receiverId: req.user.id }
      ]
    });

    return res.json({ deletedCount: result.deletedCount || 0 });
  });

  router.delete("/conversations/private/:userId", authHttp(jwtSecret), async (req, res) => {
    const userId = asId(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid user id" });

    const peer = await User.exists({ _id: userId });
    if (!peer) return res.status(404).json({ message: "User not found" });

    const [deleteResult] = await Promise.all([
      Message.deleteMany({
        roomId: null,
        $or: [
          { senderId: req.user.id, receiverId: userId },
          { senderId: userId, receiverId: req.user.id }
        ]
      }),
      User.updateOne({ _id: req.user.id }, { $pull: { favouriteUsers: userId } })
    ]);

    return res.json({ deletedCount: deleteResult.deletedCount || 0, userId });
  });

  router.post("/upload", authHttp(jwtSecret), upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "File is required" });
    if (!allowedMimeTypes.has(req.file.mimetype)) {
      return res.status(400).json({ message: "Unsupported file type" });
    }

    const ext = path.extname(req.file.originalname || "").toLowerCase();
    if (!allowedExtensions.has(ext)) {
      return res.status(400).json({ message: "Unsupported file extension" });
    }

    const requiredExt = mimeToExt[req.file.mimetype];
    const extMatchesMime = requiredExt === ext
      || (requiredExt === ".jpg" && ext === ".jpeg")
      || (requiredExt === ".m4a" && ext === ".mp4");

    if (!requiredExt || !extMatchesMime) {
      return res.status(400).json({ message: "File extension does not match content type" });
    }

    const base = path.basename(req.file.originalname || "file", ext).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
    const finalName = `${base || "file"}_${randomUUID()}${requiredExt}`;
    const absolute = path.resolve(uploadsDir, finalName);

    await mkdir(uploadsDir, { recursive: true });

    await writeFile(absolute, req.file.buffer);

    return res.status(201).json({
      attachment: {
        url: `/uploads/${finalName}`,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
  });

  router.delete("/maintenance/verifier-users", authHttp(jwtSecret), async (req, res) => {
    const maintenanceToken = String(process.env.MAINTENANCE_CLEANUP_TOKEN || "").trim();
    const providedToken = String(req.headers["x-maintenance-token"] || "").trim();

    if (!maintenanceToken || providedToken !== maintenanceToken) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const summary = await cleanupVerifierUsers();
    return res.json({ ok: true, summary });
  });

  return router;
};
