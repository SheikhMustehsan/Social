import { Queue } from "bullmq";
import Redis from "ioredis";
import * as dotenv from "dotenv";
dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Connect to Redis with BullMQ-required settings and lazy connection
export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Must be null for BullMQ compatibility
  lazyConnect: true,          // Do not block server startup if Redis is offline
  showFriendlyErrorStack: true,
  retryStrategy(times) {
    // Attempt reconnection up to 3 times, then give up to avoid terminal spam
    if (times > 3) {
      return null; // stop retrying
    }
    return Math.min(times * 1000, 3000); // retry after 1s, 2s, 3s
  }
});

connection.on("error", (err) => {
  // Gracefully log warning instead of crashing process
  console.warn("⚠️ [Redis Offline] Background job scheduling queue is disabled. Fastify is running in API-only mode.");
});

export const postingQueue = new Queue("posting-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry failed browser jobs up to 3 times
    backoff: {
      type: "exponential",
      delay: 10000, // Wait 10 seconds before first retry
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep logs of failures
  },
});

console.log("⚡ BullMQ Scheduler Queue initialized with Redis.");
