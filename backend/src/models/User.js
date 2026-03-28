import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 30 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatarUrl: { type: String, default: "" },
    about: { type: String, default: "🙏 Radhe Radhe 🙏", maxlength: 140 },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    favouriteUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isOnline: { type: Boolean, default: false },
    socketId: { type: String, default: "" },
    lastSeen: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
