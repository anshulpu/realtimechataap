import { io } from "socket.io-client";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Message from "../src/models/Message.js";
import Room from "../src/models/Room.js";

const SERVER = process.env.SERVER || "http://localhost:4000";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/realtime_chat";

const uid = Date.now();
const receiverCreds = {
  username: `receiver_${uid}`,
  email: `receiver_${uid}@mail.com`,
  password: "123456"
};
const senderCreds = {
  username: `sender_${uid}`,
  email: `sender_${uid}@mail.com`,
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

const waitForPrivateMessage = (socket, expectedMessage, expectedSenderId, label, timeoutMs = 8000) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("receiveMessage", onEvent);
      reject(new Error(`Timeout waiting for receiveMessage on ${label}`));
    }, timeoutMs);

    const onEvent = (payload) => {
      if (payload?.message !== expectedMessage) return;
      if (String(payload?.senderId) !== String(expectedSenderId)) return;
      clearTimeout(timeout);
      socket.off("receiveMessage", onEvent);
      console.log(`[receive] ${label} socket=${socket.id} message=${payload.message}`);
      resolve(payload);
    };

    socket.on("receiveMessage", onEvent);
  });

const sendPrivateMessage = (senderSocket, receiverId, message) =>
  new Promise((resolve, reject) => {
    senderSocket.emit(
      "sendMessage",
      { receiverId, message },
      (ack) => {
        if (!ack?.ok) {
          reject(new Error(`sendMessage failed: ${ack?.message || "unknown"}`));
          return;
        }
        resolve(ack.message);
      }
    );
  });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cleanupTestData = async ({ userIds = [], emails = [] } = {}) => {
  if (!mongoose.connection.readyState) {
    await mongoose.connect(MONGODB_URI);
  }

  const userObjectIds = userIds
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  const usersByEmail = emails.length > 0 ? await User.find({ email: { $in: emails } }).select("_id").lean() : [];
  const emailObjectIds = usersByEmail.map((u) => new mongoose.Types.ObjectId(String(u._id)));

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

const getOtherUsers = async (baseUrl, token) => {
  const response = await fetch(`${baseUrl}/api/chat/users`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GET /api/chat/users failed: ${data.message || response.status}`);
  }

  return data.users || [];
};

const run = async () => {
  const createdUserIds = [];
  const createdEmails = [receiverCreds.email, senderCreds.email];
  let receiverSocket1 = null;
  let receiverSocket2 = null;
  let senderSocket = null;

  console.log(`Using server: ${SERVER}`);

  try {
    const receiver = await register(SERVER, receiverCreds);
    const sender = await register(SERVER, senderCreds);
    createdUserIds.push(receiver?.user?.id, sender?.user?.id);

    receiverSocket1 = await connectSocket(SERVER, receiver.token, "receiver-tab-1");
    receiverSocket2 = await connectSocket(SERVER, receiver.token, "receiver-tab-2");
    senderSocket = await connectSocket(SERVER, sender.token, "sender");

    await wait(800);

    const firstMessage = `multi-socket-message-1-${uid}`;
    const inbox1 = waitForPrivateMessage(receiverSocket1, firstMessage, sender.user.id, "receiver-tab-1");
    const inbox2 = waitForPrivateMessage(receiverSocket2, firstMessage, sender.user.id, "receiver-tab-2");

    await sendPrivateMessage(senderSocket, receiver.user.id, firstMessage);
    await Promise.all([inbox1, inbox2]);

    console.log("PASS: first message delivered to both receiver sockets");

    receiverSocket1.disconnect();
    await wait(600);

    const usersAfterOneDisconnect = await getOtherUsers(SERVER, sender.token);
    const receiverAfterOneDisconnect = usersAfterOneDisconnect.find((u) => String(u.id) === String(receiver.user.id));
    if (!receiverAfterOneDisconnect?.isOnline) {
      throw new Error("FAIL: receiver should still be online after one socket disconnect");
    }

    const secondMessage = `multi-socket-message-2-${uid}`;
    const inboxRemaining = waitForPrivateMessage(receiverSocket2, secondMessage, sender.user.id, "receiver-tab-2");

    await sendPrivateMessage(senderSocket, receiver.user.id, secondMessage);
    await inboxRemaining;

    console.log("PASS: second message delivered to remaining receiver socket");

    receiverSocket2.disconnect();
    senderSocket.disconnect();

    await wait(900);

    const usersAfterAllDisconnect = await getOtherUsers(SERVER, sender.token);
    const receiverAfterAllDisconnect = usersAfterAllDisconnect.find((u) => String(u.id) === String(receiver.user.id));
    if (receiverAfterAllDisconnect?.isOnline) {
      throw new Error("FAIL: receiver should be offline after all sockets disconnect");
    }

    console.log("PASS: receiver marked offline only after all sockets disconnected");
    console.log("DONE: multi-socket same-user verification succeeded");
  } finally {
    receiverSocket1?.disconnect();
    receiverSocket2?.disconnect();
    senderSocket?.disconnect();
    await cleanupTestData({ userIds: createdUserIds, emails: createdEmails });
    console.log("Cleanup complete: temporary verifier users removed");
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
