import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null, index: true },
    message: { type: String, default: "", trim: true, maxlength: 2000 },
    attachment: {
      url: { type: String, default: "" },
      fileName: { type: String, default: "" },
      mimeType: { type: String, default: "" },
      size: { type: Number, default: 0 }
    },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
    timestamp: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

messageSchema.index({ senderId: 1, receiverId: 1, timestamp: 1 });
messageSchema.index({ roomId: 1, timestamp: 1 });

export default mongoose.model("Message", messageSchema);
