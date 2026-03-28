import { io } from "socket.io-client";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Message from "../src/models/Message.js";
import Room from "../src/models/Room.js";

const SERVER = process.env.SERVER || "http://localhost:4000";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/realtime_chat";

const uid = Date.now();
const userA = {
  username: `rtcCaller${uid}`,
  email: `rtccaller${uid}@mail.com`,
  password: "123456"
};
const userB = {
  username: `rtcReceiver${uid}`,
  email: `rtcreceiver${uid}@mail.com`,
  password: "123456"
};

const extractTokenFromSetCookie = (setCookieValue = "") => {
  const match = String(setCookieValue).match(/token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const register = async (baseUrl, payload) => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Register failed (${payload.email}): ${data.message || response.status}`);
  }

  const setCookie = response.headers.get("set-cookie") || "";
  const token = extractTokenFromSetCookie(setCookie);
  if (!token) throw new Error(`Missing auth token cookie for ${payload.email}`);

  return { user: data.user, token };
};

const connectSocket = (url, token, label) =>
  new Promise((resolve, reject) => {
    const socket = io(url, {
      transports: ["websocket"],
      auth: { token }
    });

    socket.once("connect", () => {
      console.log(`[connect] ${label} socket=${socket.id}`);
      resolve(socket);
    });

    socket.once("connect_error", (error) => reject(error));
  });

const onceWithTimeout = (socket, eventName, timeoutMs = 6000) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    };

    socket.once(eventName, onEvent);
  });

const cleanupTestData = async ({ userIds = [], emails = [] } = {}) => {
  if (!mongoose.connection.readyState) {
    await mongoose.connect(MONGODB_URI);
  }

  const userObjectIds = userIds
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  const usersByEmail = emails.length > 0 ? await User.find({ email: { $in: emails } }).select("_id").lean() : [];
  const emailObjectIds = usersByEmail.map((user) => new mongoose.Types.ObjectId(String(user._id)));

  const allUserObjectIds = Array.from(
    new Set([...userObjectIds, ...emailObjectIds].map((id) => String(id)))
  ).map((id) => new mongoose.Types.ObjectId(id));

  if (allUserObjectIds.length === 0) {
    await mongoose.connection.close();
    return;
  }

  await Message.deleteMany({
    $or: [
      { senderId: { $in: allUserObjectIds } },
      { receiverId: { $in: allUserObjectIds } }
    ]
  });

  await Room.deleteMany({
    $or: [
      { createdBy: { $in: allUserObjectIds } },
      { members: { $in: allUserObjectIds } }
    ]
  });

  await User.deleteMany({ _id: { $in: allUserObjectIds } });
  await mongoose.connection.close();
};

const run = async () => {
  const createdUserIds = [];
  const createdEmails = [userA.email, userB.email];
  let socketA = null;
  let socketB = null;

  try {
    const regA = await register(SERVER, userA);
    const regB = await register(SERVER, userB);
    createdUserIds.push(regA.user.id, regB.user.id);

    socketA = await connectSocket(SERVER, regA.token, "caller");
    socketB = await connectSocket(SERVER, regB.token, "receiver");

    const fakeOffer = { type: "offer", sdp: "fake-offer-sdp" };
    const fakeAnswer = { type: "answer", sdp: "fake-answer-sdp" };
    const fakeCandidate = {
      candidate: "candidate:1 1 udp 2122260223 192.168.0.2 54400 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0
    };

    const offerIncoming = onceWithTimeout(socketB, "webrtc:offer");
    await new Promise((resolve, reject) => {
      socketA.emit("webrtc:offer", {
        toUserId: regB.user.id,
        callType: "voice",
        offer: fakeOffer
      }, (ack) => {
        if (!ack?.ok) return reject(new Error(`offer ack failed: ${ack?.message || "unknown"}`));
        resolve();
      });
    });
    const receivedOffer = await offerIncoming;
    if (receivedOffer?.offer?.type !== "offer") throw new Error("Offer relay failed");
    console.log("PASS: webrtc:offer relayed");

    const answerIncoming = onceWithTimeout(socketA, "webrtc:answer");
    await new Promise((resolve, reject) => {
      socketB.emit("webrtc:answer", {
        toUserId: regA.user.id,
        answer: fakeAnswer
      }, (ack) => {
        if (!ack?.ok) return reject(new Error(`answer ack failed: ${ack?.message || "unknown"}`));
        resolve();
      });
    });
    const receivedAnswer = await answerIncoming;
    if (receivedAnswer?.answer?.type !== "answer") throw new Error("Answer relay failed");
    console.log("PASS: webrtc:answer relayed");

    const iceIncoming = onceWithTimeout(socketB, "webrtc:ice");
    await new Promise((resolve, reject) => {
      socketA.emit("webrtc:ice", {
        toUserId: regB.user.id,
        candidate: fakeCandidate
      }, (ack) => {
        if (!ack?.ok) return reject(new Error(`ice ack failed: ${ack?.message || "unknown"}`));
        resolve();
      });
    });
    const receivedIce = await iceIncoming;
    if (!String(receivedIce?.candidate?.candidate || "").startsWith("candidate:")) {
      throw new Error("ICE relay failed");
    }
    console.log("PASS: webrtc:ice relayed");

    const endIncoming = onceWithTimeout(socketA, "webrtc:end");
    await new Promise((resolve, reject) => {
      socketB.emit("webrtc:end", { toUserId: regA.user.id }, (ack) => {
        if (!ack?.ok) return reject(new Error(`end ack failed: ${ack?.message || "unknown"}`));
        resolve();
      });
    });
    await endIncoming;
    console.log("PASS: webrtc:end relayed");

    console.log("DONE: WebRTC signaling smoke verification succeeded");
  } finally {
    socketA?.disconnect();
    socketB?.disconnect();
    await cleanupTestData({ userIds: createdUserIds, emails: createdEmails });
    console.log("Cleanup complete: temporary WebRTC verifier users removed");
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
