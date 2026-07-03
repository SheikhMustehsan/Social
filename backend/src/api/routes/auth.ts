import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { db } from "../../db/db.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export async function authRoutes(fastify: FastifyInstance) {
  // 1. REGISTER ENDPOINT
  fastify.post("/register", async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    try {
      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return reply.status(400).send({ error: "User already exists with this email" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Check if this is the first user (if so, make them super_admin)
      const allUsers = await db.select({ id: users.id }).from(users).limit(1);
      const isFirstUser = allUsers.length === 0;
      const globalRole = isFirstUser ? "super_admin" : "member";

      // Insert new user
      const newUsers = await db.insert(users).values({
        email,
        passwordHash,
        globalRole,
      }).returning();

      const user = newUsers[0];

      // Sign JWT
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        globalRole: user.globalRole,
      });

      return reply.status(201).send({
        token,
        user: {
          id: user.id,
          email: user.email,
          globalRole: user.globalRole,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Internal server error during registration" });
    }
  });

  // 2. LOGIN ENDPOINT
  fastify.post("/login", async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    try {
      // Find user
      const foundUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (foundUsers.length === 0) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }

      const user = foundUsers[0];

      // Compare password
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }

      // Sign JWT
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        globalRole: user.globalRole,
      });

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          globalRole: user.globalRole,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Internal server error during login" });
    }
  });
}
