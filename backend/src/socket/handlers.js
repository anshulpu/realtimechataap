import mongoose from "mongoose";
import Message from "../models/Message.js";
import Room from "../models/Room.js";
import User from "../models/User.js";
import Call from "../models/Call.js";

const MESSAGE_WINDOW_MS = 2000;
const MESSAGE_LIMIT = 6;
const rateWindowByUser = new Map();

const CALL_WINDOW_MS = 15000;
const CALL_LIMIT = 4;
const callWindowByUser = new Map();

const sanitizeMessage = (raw) =>
  String(raw || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

const isRateLimited = (userId) => {
  const now = Date.now();
  const timestamps = rateWindowByUser.get(userId) || [];
  const fresh = timestamps.filter((ts) => now - ts <= MESSAGE_WINDOW_MS);
  if (fresh.length >= MESSAGE_LIMIT) {
    rateWindowByUser.set(userId, fresh);
    return true;
  }
  fresh.push(now);
  rateWindowByUser.set(userId, fresh);
  return false;
};

const normalizeAttachment = (input) => {
  if (!input || typeof input !== "object") return null;

  const url = String(input.url || "").trim();
  const fileName = String(input.fileName || "").trim().slice(0, 150);
  const mimeType = String(input.mimeType || "").trim();
  const size = Number(input.size || 0);

  const allowedMime = new Set([
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
  if (!url.startsWith("/uploads/") || !fileName || !allowedMime.has(mimeType)) return null;
  if (!Number.isFinite(size) || size <= 0 || size > 5 * 1024 * 1024) return null;

  return { url, fileName, mimeType, size };
};

const isCallRateLimited = (userId) => {
  const now = Date.now();
  const timestamps = callWindowByUser.get(userId) || [];
  const fresh = timestamps.filter((ts) => now - ts <= CALL_WINDOW_MS);
  if (fresh.length >= CALL_LIMIT) {
    callWindowByUser.set(userId, fresh);
    return true;
  }
  fresh.push(now);
  callWindowByUser.set(userId, fresh);
  return false;
};

const syncPresence = async (io, userId, socketState) => {
  const activeSocketCount = await socketState?.getActiveSocketCount?.(userId) || 0;
  const online = activeSocketCount > 0;
  let lastSeen = null;

  if (online) {
    await User.updateOne({ _id: userId }, { $set: { isOnline: true, lastSeen: null } });
  } else {
    lastSeen = new Date();
    await User.updateOne({ _id: userId }, { $set: { isOnline: false, lastSeen } });
  }

  console.log(`[socket][presence] user=${userId} activeSockets=${activeSocketCount} online=${online}`);
  io.emit("userStatus", { userId, isOnline: online, lastSeen });
};

const getAllUserSocketIds = async (io, socketState, userId) => {
  const localSocketIds = socketState?.getSocketIds?.(userId) || [];
  const roomSockets = await io.in(`user:${userId}`).fetchSockets();
  const roomSocketIds = roomSockets.map((s) => s.id);
  return Array.from(new Set([...localSocketIds, ...roomSocketIds]));
};

const getPrivateBlockRelation = async (senderId, receiverId) => {
  const [sender, receiver] = await Promise.all([
    User.findById(senderId).select("blockedUsers").lean(),
    User.findById(receiverId).select("blockedUsers").lean()
  ]);

  if (!receiver) return { receiverExists: false, blockedBySender: false, blockedByReceiver: false };

  const blockedBySender = Boolean(sender?.blockedUsers?.some((id) => String(id) === String(receiverId)));
  const blockedByReceiver = Boolean(receiver?.blockedUsers?.some((id) => String(id) === String(senderId)));
  return { receiverExists: true, blockedBySender, blockedByReceiver };
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

export const registerSocketHandlers = (io, { socketState } = {}) => {
  io.on("connection", async (socket) => {
    const userId = socket.user.id;

    await socketState?.registerSocket?.(userId, socket.id);
    const currentSocketCount = await socketState?.getActiveSocketCount?.(userId) || 0;
    console.log(`[socket][connect] user=${userId} socket=${socket.id} activeSockets=${currentSocketCount}`);

    const userRooms = await Room.find({ members: userId }).select("_id").lean();
    userRooms.forEach((r) => socket.join(`room:${String(r._id)}`));
    socket.join(`user:${userId}`);

    await syncPresence(io, userId, socketState);

    const missedCalls = await Call.find({ receiverId: userId, status: "missed", seenByReceiver: false })
      .sort({ startedAt: -1 })
      .limit(10)
      .lean();

    if (missedCalls.length > 0) {
      const userIds = Array.from(new Set(missedCalls.map((c) => String(c.callerId))));
      const users = await User.find({ _id: { $in: userIds } }).select("username avatarUrl").lean();
      const usersById = users.reduce((acc, u) => {
        acc[String(u._id)] = u;
        return acc;
      }, {});

      const payload = missedCalls.map((call) => serializeCall(call, usersById));
      io.to(`user:${userId}`).emit("call:missed", { calls: payload });

      await Call.updateMany(
        { _id: { $in: missedCalls.map((c) => c._id) } },
        { $set: { seenByReceiver: true } }
      );
    }

    socket.on("typing", ({ toUserId, roomId, isTyping }) => {
      if (roomId && mongoose.isValidObjectId(roomId)) {
        Room.findById(roomId).select("members").lean().then((room) => {
          if (!room || !room.members.some((id) => String(id) === userId)) return;
          socket.to(`room:${roomId}`).emit("typing", { userId, roomId, isTyping: Boolean(isTyping) });
        });
        return;
      }

      if (toUserId && mongoose.isValidObjectId(toUserId)) {
        if (String(toUserId) === String(userId)) return;
        getPrivateBlockRelation(userId, toUserId).then((relation) => {
          if (!relation.receiverExists) return;
          if (relation.blockedBySender || relation.blockedByReceiver) return;
          socket.to(`user:${toUserId}`).emit("typing", { userId, toUserId, isTyping: Boolean(isTyping) });
        });
      }
    });

    socket.on("sendMessage", async (payload, ack) => {
      try {
        if (isRateLimited(userId)) {
          return ack?.({ ok: false, message: "Too many messages. Please slow down." });
        }

        const message = sanitizeMessage(payload?.message);
        const receiverId = payload?.receiverId ? String(payload.receiverId) : null;
        const roomId = payload?.roomId ? String(payload.roomId) : null;
        const attachment = normalizeAttachment(payload?.attachment);
        const hasAttachment = Boolean(attachment?.url && attachment?.fileName);

        if (!message && !hasAttachment) return ack?.({ ok: false, message: "Message cannot be empty" });
        if (!receiverId && !roomId) return ack?.({ ok: false, message: "receiverId or roomId is required" });

        if (receiverId && !mongoose.isValidObjectId(receiverId)) {
          return ack?.({ ok: false, message: "Invalid receiverId" });
        }

        if (receiverId && String(receiverId) === String(userId)) {
          return ack?.({ ok: false, message: "Cannot send message to yourself" });
        }

        if (roomId) {
          if (!mongoose.isValidObjectId(roomId)) return ack?.({ ok: false, message: "Invalid roomId" });
          const room = await Room.findById(roomId).select("members").lean();
          if (!room || !room.members.some((id) => String(id) === userId)) {
            return ack?.({ ok: false, message: "Not a member of this room" });
          }
        } else if (receiverId) {
          const relation = await getPrivateBlockRelation(userId, receiverId);
          if (!relation.receiverExists) return ack?.({ ok: false, message: "Receiver not found" });
          if (relation.blockedBySender) {
            return ack?.({ ok: false, message: "Unblock this user to send messages" });
          }
          if (relation.blockedByReceiver) {
            return ack?.({ ok: false, message: "You cannot message this user" });
          }
        }

        const created = await Message.create({
          senderId: userId,
          receiverId: receiverId || null,
          roomId: roomId || null,
          message,
          attachment: hasAttachment ? attachment : undefined,
          status: "sent"
        });

        const outbound = {
          _id: String(created._id),
          senderId: String(created.senderId),
          receiverId: created.receiverId ? String(created.receiverId) : null,
          roomId: created.roomId ? String(created.roomId) : null,
          message: created.message,
          attachment: created.attachment || null,
          status: created.status,
          timestamp: created.timestamp
        };

        if (roomId) {
          io.to(`room:${roomId}`).emit("receiveMessage", outbound);
        } else {
          const receiverSocketIds = await getAllUserSocketIds(io, socketState, receiverId);
          const senderSocketIds = await getAllUserSocketIds(io, socketState, userId);
          const isReceiverOnline = receiverSocketIds.length > 0;
          const nextStatus = isReceiverOnline ? "delivered" : "sent";

          receiverSocketIds.forEach((receiverSocketId) => {
            io.to(receiverSocketId).emit("receiveMessage", { ...outbound, status: nextStatus });
          });

          senderSocketIds.forEach((senderSocketId) => {
            io.to(senderSocketId).emit("receiveMessage", outbound);
          });

          console.log(
            `[socket][deliver] message=${String(created._id)} sender=${userId} receiver=${receiverId} receiverSockets=${receiverSocketIds.length} delivered=${isReceiverOnline}`
          );

          if (isReceiverOnline) {
            await Message.updateOne({ _id: created._id }, { $set: { status: "delivered" } });

            senderSocketIds.forEach((senderSocketId) => {
              io.to(senderSocketId).emit("messageStatus", { messageIds: [String(created._id)], status: "delivered" });
            });
          }
        }

        ack?.({ ok: true, message: outbound });
      } catch {
        ack?.({ ok: false, message: "Failed to send message" });
      }
    });

    socket.on("markRead", async ({ messageIds }) => {
      if (!Array.isArray(messageIds) || messageIds.length === 0) return;
      const docs = await Message.find({ _id: { $in: messageIds }, receiverId: userId }).select("_id senderId").lean();
      if (docs.length === 0) return;

      const ids = docs.map((doc) => doc._id);
      await Message.updateMany({ _id: { $in: messageIds }, receiverId: userId }, { $set: { status: "read" } });

      const bySender = docs.reduce((acc, doc) => {
        const key = String(doc.senderId);
        if (!acc[key]) acc[key] = [];
        acc[key].push(String(doc._id));
        return acc;
      }, {});

      Object.entries(bySender).forEach(([senderId, idsBySender]) => {
        io.to(`user:${senderId}`).emit("messageStatus", { messageIds: idsBySender, status: "read" });
      });

      io.to(`user:${userId}`).emit("messagesRead", { userId, messageIds: ids.map(String) });
    });

    socket.on("webrtc:offer", async (payload, ack) => {
      try {
        const toUserId = String(payload?.toUserId || "");
        const callType = String(payload?.callType || "voice").toLowerCase();
        const offer = payload?.offer;

        if (!mongoose.isValidObjectId(toUserId)) {
          return ack?.({ ok: false, message: "Invalid toUserId" });
        }
        if (toUserId === String(userId)) {
          return ack?.({ ok: false, message: "Cannot call yourself" });
        }
        if (!["voice", "video"].includes(callType)) {
          return ack?.({ ok: false, message: "Invalid call type" });
        }
        if (!offer || typeof offer !== "object") {
          return ack?.({ ok: false, message: "Invalid offer" });
        }

        if (isCallRateLimited(userId)) {
          return ack?.({ ok: false, message: "Too many call attempts. Please wait." });
        }

        const relation = await getPrivateBlockRelation(userId, toUserId);
        if (!relation.receiverExists) {
          return ack?.({ ok: false, message: "User not found" });
        }
        if (relation.blockedBySender || relation.blockedByReceiver) {
          return ack?.({ ok: false, message: "Call is not allowed for this user" });
        }

        const targetSocketIds = await getAllUserSocketIds(io, socketState, toUserId);
        const callDoc = await Call.create({
          callerId: userId,
          receiverId: toUserId,
          callType,
          status: targetSocketIds.length > 0 ? "ringing" : "missed",
          startedAt: new Date(),
          endedAt: targetSocketIds.length > 0 ? null : new Date(),
          seenByReceiver: targetSocketIds.length > 0 ? false : false
        });

        if (targetSocketIds.length === 0) {
          io.to(`user:${userId}`).emit("call:status", {
            callId: String(callDoc._id),
            status: "missed",
            callType,
            peerId: toUserId
          });
          return ack?.({ ok: true, callId: String(callDoc._id), offline: true });
        }

        io.to(`user:${toUserId}`).emit("webrtc:offer", {
          fromUserId: String(userId),
          fromUsername: socket.user.username,
          callType,
          offer,
          callId: String(callDoc._id)
        });

        io.to(`user:${userId}`).emit("call:status", {
          callId: String(callDoc._id),
          status: "ringing",
          callType,
          peerId: toUserId
        });

        ack?.({ ok: true, callId: String(callDoc._id), offline: false });
      } catch {
        ack?.({ ok: false, message: "Failed to start call" });
      }
    });

    socket.on("webrtc:answer", async (payload, ack) => {
      try {
        const toUserId = String(payload?.toUserId || "");
        const answer = payload?.answer;
        const callId = String(payload?.callId || "");

        if (!mongoose.isValidObjectId(toUserId)) {
          return ack?.({ ok: false, message: "Invalid toUserId" });
        }
        if (!answer || typeof answer !== "object") {
          return ack?.({ ok: false, message: "Invalid answer" });
        }

        if (mongoose.isValidObjectId(callId)) {
          await Call.updateOne(
            { _id: callId },
            { $set: { status: "answered", connectedAt: new Date() } }
          );
          io.to(`user:${userId}`).emit("call:status", { callId, status: "answered" });
          io.to(`user:${toUserId}`).emit("call:status", { callId, status: "answered" });
        }

        io.to(`user:${toUserId}`).emit("webrtc:answer", {
          fromUserId: String(userId),
          answer,
          callId
        });

        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, message: "Failed to send answer" });
      }
    });

    socket.on("webrtc:ice", async (payload, ack) => {
      try {
        const toUserId = String(payload?.toUserId || "");
        const candidate = payload?.candidate;

        if (!mongoose.isValidObjectId(toUserId)) {
          return ack?.({ ok: false, message: "Invalid toUserId" });
        }
        if (!candidate || typeof candidate !== "object") {
          return ack?.({ ok: false, message: "Invalid candidate" });
        }

        io.to(`user:${toUserId}`).emit("webrtc:ice", {
          fromUserId: String(userId),
          candidate
        });

        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, message: "Failed to send ICE candidate" });
      }
    });

    socket.on("webrtc:reject", (payload, ack) => {
      const toUserId = String(payload?.toUserId || "");
      const callId = String(payload?.callId || "");
      if (!mongoose.isValidObjectId(toUserId)) {
        return ack?.({ ok: false, message: "Invalid toUserId" });
      }

      if (mongoose.isValidObjectId(callId)) {
        Call.updateOne({ _id: callId }, { $set: { status: "rejected", endedAt: new Date() } }).exec();
        io.to(`user:${userId}`).emit("call:status", { callId, status: "rejected" });
      }

      io.to(`user:${toUserId}`).emit("webrtc:reject", {
        fromUserId: String(userId),
        callId
      });
      ack?.({ ok: true });
    });

    socket.on("webrtc:end", (payload, ack) => {
      const toUserId = String(payload?.toUserId || "");
      const callId = String(payload?.callId || "");
      if (!mongoose.isValidObjectId(toUserId)) {
        return ack?.({ ok: false, message: "Invalid toUserId" });
      }

      if (mongoose.isValidObjectId(callId)) {
        Call.updateOne({ _id: callId }, { $set: { status: "ended", endedAt: new Date() } }).exec();
        io.to(`user:${userId}`).emit("call:status", { callId, status: "ended" });
      }

      io.to(`user:${toUserId}`).emit("webrtc:end", {
        fromUserId: String(userId),
        callId
      });
      ack?.({ ok: true });
    });

    socket.on("disconnect", async () => {
      await socketState?.unregisterSocket?.(userId, socket.id);
      const currentSocketCount = await socketState?.getActiveSocketCount?.(userId) || 0;
      console.log(`[socket][disconnect] user=${userId} socket=${socket.id} activeSockets=${currentSocketCount}`);
      await syncPresence(io, userId, socketState);
    });
  });
};
