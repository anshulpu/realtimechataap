import mongoose from "mongoose";
import User from "../src/models/User.js";
import Message from "../src/models/Message.js";
import Room from "../src/models/Room.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/realtime_chat";

const verifierUserRegex = /^(sock[ab]_\w+|user[ab]_\d+|sender_\d+|receiver_\d+)$/i;
const verifierEmailRegex = /^((a|b)_\d+@mail\.com|(sender|receiver)_\d+@mail\.com|sock[ab]_\w+@test\.local)$/i;

async function run() {
  await mongoose.connect(MONGODB_URI);

  const users = await User.find({
    $or: [
      { username: { $regex: verifierUserRegex } },
      { email: { $regex: verifierEmailRegex } }
    ]
  })
    .select("_id username email")
    .lean();

  if (users.length === 0) {
    console.log("No verifier/test users found.");
    await mongoose.connection.close();
    return;
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

  console.log(`Removed users: ${userDelete.deletedCount || 0}`);
  console.log(`Removed messages: ${messageDelete.deletedCount || 0}`);
  console.log(`Removed rooms: ${roomDelete.deletedCount || 0}`);

  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error(error.message || error);
  if (mongoose.connection.readyState) {
    await mongoose.connection.close();
  }
  process.exit(1);
});
