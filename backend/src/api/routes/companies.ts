import { FastifyInstance } from "fastify";
import { db } from "../../db/db.js";
import { companies, companyMembers, users } from "../../db/schema.js";
import { authenticate, authorizeCompanyAccess } from "../middleware/auth.js";
import { eq, and } from "drizzle-orm";

export async function companyRoutes(fastify: FastifyInstance) {
  // Add authentication hook to all routes in this plugin
  fastify.addHook("preHandler", authenticate);

  // 1. CREATE A NEW COMPANY (Super Admin Only)
  fastify.post("/", async (request, reply) => {
    if (request.user.globalRole !== "super_admin") {
      return reply.status(403).send({ error: "Forbidden: Only global Super Admins can create companies." });
    }

    const { name } = request.body as any;

    if (!name) {
      return reply.status(400).send({ error: "Company name is required" });
    }

    try {
      // Insert company
      const newCompanies = await db.insert(companies).values({ name }).returning();
      const company = newCompanies[0];

      // Add current user as admin of this company
      await db.insert(companyMembers).values({
        companyId: company.id,
        userId: request.user.id,
        role: "admin",
      });

      return reply.status(210).send(company);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to create company" });
    }
  });

  // 2. LIST ALL ACCESS-ALLOWED COMPANIES
  fastify.get("/", async (request, reply) => {
    const user = request.user;

    try {
      if (user.globalRole === "super_admin") {
        // Super admin sees all companies in the system
        const allCompanies = await db.select().from(companies);
        return reply.send(allCompanies);
      } else {
        // Members see only companies they belong to
        const memberCompanies = await db
          .select({
            id: companies.id,
            name: companies.name,
            createdAt: companies.createdAt,
            role: companyMembers.role,
          })
          .from(companyMembers)
          .innerJoin(companies, eq(companyMembers.companyId, companies.id))
          .where(eq(companyMembers.userId, user.id));

        return reply.send(memberCompanies);
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to list companies" });
    }
  });

  // 3. ADD TEAM MEMBER TO A COMPANY
  fastify.post("/:companyId/members", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const { companyId } = request.params as any;
    const { email, role } = request.body as any;
    const companyRole = (request as any).companyRole; // From authorizeCompanyAccess
    const globalRole = request.user.globalRole;

    // Check permissions: only company 'admin' or system 'super_admin' can invite members
    if (globalRole !== "super_admin" && companyRole !== "admin") {
      return reply.status(403).send({ error: "Forbidden: Only admins can manage members" });
    }

    if (!email || !role) {
      return reply.status(400).send({ error: "Member email and role are required" });
    }

    if (!["admin", "editor", "viewer"].includes(role)) {
      return reply.status(400).send({ error: "Invalid role. Must be 'admin', 'editor', or 'viewer'" });
    }

    try {
      // Find the user to add by email
      const targetUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (targetUsers.length === 0) {
        return reply.status(404).send({ error: `User with email ${email} not found. They must register first.` });
      }

      const targetUser = targetUsers[0];

      // Check if user is already a member
      const existingMember = await db
        .select()
        .from(companyMembers)
        .where(
          and(
            eq(companyMembers.companyId, companyId),
            eq(companyMembers.userId, targetUser.id)
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        return reply.status(400).send({ error: "User is already a member of this company" });
      }

      // Add to company
      await db.insert(companyMembers).values({
        companyId,
        userId: targetUser.id,
        role,
      });

      return reply.status(201).send({ success: true, message: `Added ${email} as ${role}` });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to add member" });
    }
  });

  // 4. LIST ALL MEMBERS OF A COMPANY
  fastify.get("/:companyId/members", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const { companyId } = request.params as any;

    try {
      const members = await db
        .select({
          id: companyMembers.id,
          role: companyMembers.role,
          user: {
            id: users.id,
            email: users.email,
          },
        })
        .from(companyMembers)
        .innerJoin(users, eq(companyMembers.userId, users.id))
        .where(eq(companyMembers.companyId, companyId));

      return reply.send(members);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to list members" });
    }
  });
}
