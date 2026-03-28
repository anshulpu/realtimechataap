export const createSocketState = ({ redisClient } = {}) => {
  const userToSockets = new Map();
  const socketToUser = new Map();

  const redisKey = (userId) => `chat:user:${userId}:sockets`;

  const addLocal = (userId, socketId) => {
    if (!userToSockets.has(userId)) userToSockets.set(userId, new Set());
    userToSockets.get(userId).add(socketId);
    socketToUser.set(socketId, userId);
  };

  const removeLocal = (userId, socketId) => {
    const set = userToSockets.get(userId);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) userToSockets.delete(userId);
    }
    socketToUser.delete(socketId);
  };

  return {
    async registerSocket(userId, socketId) {
      addLocal(userId, socketId);
      if (redisClient?.isOpen) {
        await redisClient.sAdd(redisKey(userId), socketId);
      }
    },

    async unregisterSocket(userId, socketId) {
      removeLocal(userId, socketId);
      if (redisClient?.isOpen) {
        await redisClient.sRem(redisKey(userId), socketId);
      }
    },

    getLocalSocketCount(userId) {
      return userToSockets.get(userId)?.size || 0;
    },

    async getRedisSocketCount(userId) {
      if (!redisClient?.isOpen) return 0;
      return redisClient.sCard(redisKey(userId));
    },

    getSocketIds(userId) {
      const set = userToSockets.get(userId);
      return set ? Array.from(set) : [];
    },

    getUserIdBySocket(socketId) {
      return socketToUser.get(socketId) || null;
    },

    async getActiveSocketCount(userId) {
      if (!redisClient?.isOpen) return this.getLocalSocketCount(userId);
      return this.getRedisSocketCount(userId);
    },

    async isUserOnline(userId) {
      const count = await this.getActiveSocketCount(userId);
      return count > 0;
    }
  };
};
