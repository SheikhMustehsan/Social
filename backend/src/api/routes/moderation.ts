import { FastifyInstance } from "fastify";
import { db } from "../../db/db.js";
import { moderationRules, socialProfiles, syncJobs } from "../../db/schema.js";
import { authenticate, authorizeCompanyAccess } from "../middleware/auth.js";
import { eq, and, desc, inArray } from "drizzle-orm";

export async function moderationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // 1. GET ALL RULES FOR COMPANY
  fastify.get("/rules", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;

    try {
      const rules = await db
        .select({
          id: moderationRules.id,
          companyId: moderationRules.companyId,
          socialProfileId: moderationRules.socialProfileId,
          platform: moderationRules.platform,
          type: moderationRules.type,
          triggerKeyword: moderationRules.triggerKeyword,
          replyText: moderationRules.replyText,
          createdAt: moderationRules.createdAt,
          profileName: socialProfiles.profileName,
        })
        .from(moderationRules)
        .leftJoin(socialProfiles, eq(moderationRules.socialProfileId, socialProfiles.id))
        .where(eq(moderationRules.companyId, companyId));

      return reply.send(rules);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch moderation rules" });
    }
  });

  // 2. CREATE RULE
  fastify.post("/rules", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;
    const { socialProfileId, platform, type, triggerKeyword, replyText } = request.body as any;

    if (!type || !triggerKeyword || replyText === undefined) {
      return reply.status(400).send({ error: "Missing required fields" });
    }

    try {
      const [newRule] = await db
        .insert(moderationRules)
        .values({
          companyId,
          socialProfileId: socialProfileId || null,
          platform: platform || null,
          type,
          triggerKeyword,
          replyText,
        })
        .returning();

      return reply.send(newRule);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to create moderation rule" });
    }
  });

  // 3. DELETE RULE
  fastify.delete("/rules/:id", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;
    const { id } = request.params as { id: string };

    try {
      await db
        .delete(moderationRules)
        .where(and(eq(moderationRules.id, id), eq(moderationRules.companyId, companyId)));

      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to delete moderation rule" });
    }
  });

  // 4. GET RECENT MODERATION SYNC JOBS
  fastify.get("/sync-jobs", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;

    try {
      const jobs = await db
        .select()
        .from(syncJobs)
        .where(
          and(
            eq(syncJobs.companyId, companyId),
            inArray(syncJobs.jobType, ["scan_dms", "crawl_comments", "scan_dms_all", "crawl_comments_all"])
          )
        )
        .orderBy(desc(syncJobs.startedAt))
        .limit(10);

      return reply.send(jobs);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch sync jobs" });
    }
  });
}
