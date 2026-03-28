import mongoose from "mongoose";

export const connectDb = async (mongoUri) => {
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
};
