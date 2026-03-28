import { io } from "socket.io-client";
import mongoose from "mongoose";
import User from "./src/models/User.js";
import Message from "./src/models/Message.js";
import Room from "./src/models/Room.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/realtime_chat";

async function cleanupTestData({ userIds = [], emails = [] } = {}) {
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
}

const base = "http://localhost:4000";
const suffix = Math.random().toString(36).slice(2, 10);
const userA = { username: `sockA_${suffix}`, email: `socka_${suffix}@test.local`, password: "pass1234" };
const userB = { username: `sockB_${suffix}`, email: `sockb_${suffix}@test.local`, password: "pass1234" };
const createdUserIds = [];
const createdEmails = [userA.email, userB.email];

let socketA = null;
let socketB = null;

try {

  async function postJson(url, body, cookie = "") {
    const headers = { "content-type": "application/json" };
    if (cookie) headers.cookie = cookie;
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    return { response, data, setCookie: response.headers.get("set-cookie") || "" };
  }

  function cookieKey(setCookieHeader) {
    return String(setCookieHeader || "").split(";")[0];
  }

  const regA = await postJson(`${base}/api/auth/register`, userA);
  const regB = await postJson(`${base}/api/auth/register`, userB);
  if (!regA.response.ok || !regB.response.ok) {
    throw new Error(`register failed A=${regA.response.status} B=${regB.response.status}`);
  }

  createdUserIds.push(regA?.data?.user?.id, regB?.data?.user?.id);

  const cookieA = cookieKey(regA.setCookie);
  const cookieB = cookieKey(regB.setCookie);
  if (!cookieA || !cookieB) {
    throw new Error("missing auth cookie(s)");
  }

  const meARes = await fetch(`${base}/api/auth/me`, { headers: { cookie: cookieA } });
  const meBRes = await fetch(`${base}/api/auth/me`, { headers: { cookie: cookieB } });
  const meA = await meARes.json();
  const meB = await meBRes.json();
  if (!meARes.ok || !meBRes.ok) {
    throw new Error(`me failed A=${meARes.status} B=${meBRes.status}`);
  }

  const idA = meA.user.id;
  const idB = meB.user.id;

  const blockRes = await fetch(`${base}/api/chat/users/${idB}/block`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieA },
    body: JSON.stringify({ blocked: true })
  });
  if (!blockRes.ok) {
    const d = await blockRes.json().catch(() => ({}));
    throw new Error(`block failed ${blockRes.status} ${JSON.stringify(d)}`);
  }

  const tokenA = cookieA.split("=")[1];
  const tokenB = cookieB.split("=")[1];

  socketA = io(base, {
    transports: ["websocket"],
    auth: { token: tokenA },
    extraHeaders: { Cookie: cookieA }
  });
  socketB = io(base, {
    transports: ["websocket"],
    auth: { token: tokenB },
    extraHeaders: { Cookie: cookieB }
  });

  const waitConnected = (socket) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("socket connect timeout")), 8000);
    socket.on("connect", () => { clearTimeout(t); resolve(); });
    socket.on("connect_error", (e) => { clearTimeout(t); reject(e); });
  });
  await Promise.all([waitConnected(socketA), waitConnected(socketB)]);

  const ackA = await new Promise((resolve) => {
    socketA.emit("sendMessage", { receiverId: idB, message: "hi from A" }, resolve);
  });
  const ackB = await new Promise((resolve) => {
    socketB.emit("sendMessage", { receiverId: idA, message: "hi from B" }, resolve);
  });

  console.log("A->B", JSON.stringify(ackA));
  console.log("B->A", JSON.stringify(ackB));

  socketA?.close();
  socketB?.close();
} catch (error) {
  console.error("BLOCK_TEST_ERROR", error?.message || error);
  process.exitCode = 1;
} finally {
  try {
    await cleanupTestData({ userIds: createdUserIds, emails: createdEmails });
    console.log("Cleanup complete: temporary block-check users removed");
  } catch (cleanupError) {
    console.error("CLEANUP_ERROR", cleanupError?.message || cleanupError);
  }
}
