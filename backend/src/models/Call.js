import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    callerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    callType: { type: String, enum: ["voice", "video"], default: "voice" },
    status: {
      type: String,
      enum: ["calling", "ringing", "answered", "rejected", "missed", "ended"],
      default: "calling",
      index: true
    },
    startedAt: { type: Date, default: Date.now },
    connectedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    seenByReceiver: { type: Boolean, default: false, index: true }
  },
  { versionKey: false }
);

callSchema.index({ receiverId: 1, status: 1, startedAt: -1 });
callSchema.index({ callerId: 1, receiverId: 1, startedAt: -1 });

export default mongoose.model("Call", callSchema);
