import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

export const setupRedisAdapter = async (io, redisUrl) => {
  if (!redisUrl) {
    return { enabled: false, pubClient: null, subClient: null };
  }

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (error) => {
    console.error("Redis pub client error:", error.message);
  });

  subClient.on("error", (error) => {
    console.error("Redis sub client error:", error.message);
  });

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  return { enabled: true, pubClient, subClient };
};
