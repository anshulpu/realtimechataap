import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { authHttp, signToken } from "../middleware/auth.js";

const router = express.Router();

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const verifierUserRegex = /^(sock[ab]_\w+|user[ab]_\d+|sender_\d+|receiver_\d+)$/i;
const verifierEmailRegex = /^((a|b)_\d+@mail\.com|(sender|receiver)_\d+@mail\.com|sock[ab]_\w+@test\.local)$/i;
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

export const buildAuthRoutes = (jwtSecret) => {
  router.post("/register", async (req, res) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const allowVerifierUsers = String(process.env.ALLOW_VERIFIER_USERS || "false").toLowerCase() === "true";

    if (username.length < 3) return res.status(400).json({ message: "Username must be at least 3 characters" });
    if (!isEmail(email)) return res.status(400).json({ message: "Invalid email format" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (!allowVerifierUsers && (verifierUserRegex.test(username) || verifierEmailRegex.test(email))) {
      return res.status(400).json({ message: "Reserved username/email pattern is not allowed" });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, passwordHash });

    const token = signToken(user, jwtSecret);
    res.cookie("token", token, cookieOptions);

    return res.status(201).json({
      message: "Account created successfully",
      user: { id: String(user._id), username: user.username, email: user.email, avatarUrl: user.avatarUrl }
    });
  });

  router.post("/login", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user, jwtSecret);
    res.cookie("token", token, cookieOptions);

    return res.json({ user: { id: String(user._id), username: user.username, email: user.email, avatarUrl: user.avatarUrl } });
  });

  router.post("/logout", (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
    return res.json({ message: "Logged out" });
  });

  router.get("/me", authHttp(jwtSecret), async (req, res) => {
    const user = await User.findById(req.user.id).select("username email avatarUrl isOnline lastSeen").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user: { id: String(user._id), ...user } });
  });

  return router;
};
