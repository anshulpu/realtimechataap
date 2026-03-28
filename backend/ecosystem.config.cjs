module.exports = {
  apps: [
    {
      name: "realtime-chat-backend",
      script: "src/server.js",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        REDIS_URL: "redis://127.0.0.1:6379"
      }
    }
  ]
};
