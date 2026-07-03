import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../db/db.js";
import { companyMembers } from "../../db/schema.js";
import { and, eq } from "drizzle-orm";

export interface UserPayload {
  id: string;
  email: string;
  globalRole: string; // 'super_admin' | 'member'
}

declare module "fastify" {
  interface FastifyRequest {
    user: UserPayload;
  }
}

// 1. General Authentication Verification (Verifies JWT)
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: "Unauthorized: Invalid or missing token" });
  }
}

// 2. Multi-Tenant Workspace Authorization Check
// Verifies if the authenticated user has access to the requested company/workspace.
export async function authorizeCompanyAccess(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) {
    return reply.status(401).send({ error: "Unauthorized: User session missing" });
  }

  // Super admins have access to all companies
  if (user.globalRole === "super_admin") {
    return;
  }

  // Get the target company ID from headers or query params
  const companyId = (request.headers["x-company-id"] as string) || (request.query as any)?.companyId;

  if (!companyId) {
    return reply.status(400).send({ error: "Bad Request: Missing Company Context (x-company-id header)" });
  }

  try {
    // Check if user is associated with this company in the database
    const membership = await db
      .select()
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.userId, user.id),
          eq(companyMembers.companyId, companyId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return reply.status(403).send({ error: "Forbidden: You do not have access to this company workspace" });
    }

    // Attach role in company to request for downstream handlers if needed
    (request as any).companyRole = membership[0].role;
  } catch (error) {
    console.error("Multi-tenant check error:", error);
    return reply.status(500).send({ error: "Internal Server Error during authorization" });
  }
}

// 3. Admin-Only Workspace Authorization Check
// Verifies if the user is an Admin of the active workspace or a global Super Admin.
export async function authorizeCompanyAdmin(request: FastifyRequest, reply: FastifyReply) {
  // First run the general company access check
  await authorizeCompanyAccess(request, reply);
  if (reply.sent) return; // Stop if the response was already sent

  const user = request.user;
  if (user.globalRole === "super_admin") {
    return; // Super admins bypass all workspace checks
  }

  const role = (request as any).companyRole;
  if (role !== "admin") {
    return reply.status(403).send({ error: "Forbidden: Admin privileges are required for this action." });
  }
}
