import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import * as dotenv from "dotenv";
import { authRoutes } from "./api/routes/auth.js";
import { companyRoutes } from "./api/routes/companies.js";
import { schedulerRoutes } from "./api/routes/scheduler.js";
import { profileRoutes } from "./api/routes/profiles.js";
import { analyticsRoutes } from "./api/routes/analytics.js";
import { uploadRoutes } from "./api/routes/upload.js";

// Load background workers
import "./queue/worker.js";

dotenv.config();

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const jwtSecret = process.env.JWT_SECRET || "development_secret_key_change_in_production";

const fastify = Fastify({
  logger: true,
});

// Register Plugins
await fastify.register(cors, {
  origin: "*", // Adjust in production
});

await fastify.register(jwt, {
  secret: jwtSecret,
});

await fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // Accept media files up to 100MB
  },
});

// Register Routes
await fastify.register(authRoutes, { prefix: "/api/auth" });
await fastify.register(companyRoutes, { prefix: "/api/companies" });
await fastify.register(schedulerRoutes, { prefix: "/api/scheduler" });
await fastify.register(profileRoutes, { prefix: "/api/profiles" });
await fastify.register(analyticsRoutes, { prefix: "/api/analytics" });
await fastify.register(uploadRoutes, { prefix: "/api/scheduler" });

// Basic Health Check
fastify.get("/health", async (request, reply) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Start Server
const start = async () => {
  try {
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`📡 Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
