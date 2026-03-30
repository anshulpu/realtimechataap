import dotenv from "dotenv";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { connectDb } from "./config/db.js";
import { setupRedisAdapter } from "./config/redis.js";
import { authSocket } from "./middleware/auth.js";
import { buildAuthRoutes } from "./routes/auth.js";
import { buildChatRoutes } from "./routes/chat.js";
import { registerSocketHandlers } from "./socket/handlers.js";
import { createSocketState } from "./socket/socketState.js";

dotenv.config();

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://realtimechataap-zpvo.onrender.com",
  "https://realtimechatapp.web.app"
];
const REDIS_URL = process.env.REDIS_URL || "";

if (!JWT_SECRET || !MONGODB_URI) {
  throw new Error("Missing JWT_SECRET or MONGODB_URI");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, "../../frontend");
const uploadsPath = path.resolve(__dirname, "../uploads");

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

const io = new Server(server, {
  cors: corsOptions
});

app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api/auth", buildAuthRoutes(JWT_SECRET));
app.use("/api/chat", buildChatRoutes(JWT_SECRET));

app.use("/uploads", express.static(uploadsPath));
app.use(express.static(frontendPath));
app.get("/", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));

io.use(authSocket(JWT_SECRET));
let redisPubClient = null;
let redisSubClient = null;

connectDb(MONGODB_URI).then(async () => {
  const redisSetup = await setupRedisAdapter(io, REDIS_URL);
  redisPubClient = redisSetup.pubClient;
  redisSubClient = redisSetup.subClient;

  const socketState = createSocketState({ redisClient: redisPubClient });
  registerSocketHandlers(io, { socketState });

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Socket.IO adapter: ${redisSetup.enabled ? "redis" : "in-memory"}`);
  });
});

const gracefulShutdown = async () => {
  await Promise.allSettled([
    redisPubClient?.quit?.(),
    redisSubClient?.quit?.()
  ]);
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
