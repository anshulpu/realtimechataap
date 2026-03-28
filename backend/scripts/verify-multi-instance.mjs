import { io } from "socket.io-client";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Message from "../src/models/Message.js";
import Room from "../src/models/Room.js";

const SERVER_A = process.env.SERVER_A || "http://localhost:4001";
const SERVER_B = process.env.SERVER_B || "http://localhost:4002";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/realtime_chat";

const uid = Date.now();
const user1 = { username: `userA_${uid}`, email: `a_${uid}@mail.com`, password: "123456" };
const user2 = { username: `userB_${uid}`, email: `b_${uid}@mail.com`, password: "123456" };

const api = async (baseUrl, path, method = "GET", body) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${baseUrl}${path} failed: ${data.message || response.status}`);
  }

  return data;
};

const waitForEvent = (socket, event, timeoutMs = 6000) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    };

    socket.once(event, onEvent);
  });

const connectSocket = (url, token) =>
  new Promise((resolve, reject) => {
    const socket = io(url, {
      transports: ["websocket"],
      auth: { token }
    });

    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error) => reject(error));
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

const run = async () => {
  const createdUserIds = [];
  const createdEmails = [user1.email, user2.email];
  let socket1 = null;
  let socket2 = null;

  console.log(`Using Server A: ${SERVER_A}`);
  console.log(`Using Server B: ${SERVER_B}`);

  try {
    const reg1 = await api(SERVER_A, "/api/auth/register", "POST", user1);
    const reg2 = await api(SERVER_B, "/api/auth/register", "POST", user2);
    createdUserIds.push(reg1?.user?.id, reg2?.user?.id);

    socket1 = await connectSocket(SERVER_A, reg1.token);
    socket2 = await connectSocket(SERVER_B, reg2.token);

    await wait(1200);

    const inboxPromise = waitForEvent(socket2, "receiveMessage", 8000);

    socket1.emit(
      "sendMessage",
      {
        receiverId: reg2.user.id,
        message: "cross-instance-test-message"
      },
      (ack) => {
        if (!ack?.ok) {
          console.error("sendMessage ack error:", ack);
        }
      }
    );

    const received = await inboxPromise;

    if (received?.message === "cross-instance-test-message") {
      console.log("PASS: Message sent on Server A was received on Server B");
    } else {
      throw new Error("FAIL: Did not receive expected message payload");
    }
  } finally {
    socket1?.disconnect();
    socket2?.disconnect();
    await cleanupTestData({ userIds: createdUserIds, emails: createdEmails });
    console.log("Cleanup complete: temporary verifier users removed");
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
