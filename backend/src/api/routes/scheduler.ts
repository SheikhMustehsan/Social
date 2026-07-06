import { FastifyInstance } from "fastify";
import { db } from "../../db/db.js";
import { posts, socialProfiles } from "../../db/schema.js";
import { authenticate, authorizeCompanyAccess, authorizeCompanyAdmin } from "../middleware/auth.js";
import { postingQueue } from "../../queue/queue.js";
import { eq, and, desc } from "drizzle-orm";

export async function schedulerRoutes(fastify: FastifyInstance) {
  // Protect all scheduler endpoints with JWT authentication
  fastify.addHook("preHandler", authenticate);

  // 1. SCHEDULE / CREATE A POST FOR MULTIPLE PLATFORMS (Admin Only)
  fastify.post("/posts", { preHandler: [authorizeCompanyAdmin] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;
    const { socialProfileIds, caption, mediaUrls, scheduledAt, postType } = request.body as any;

    if (!socialProfileIds || !Array.isArray(socialProfileIds) || socialProfileIds.length === 0) {
      return reply.status(400).send({ error: "socialProfileIds must be a non-empty array" });
    }

    try {
      const createdPosts = [];
      const scheduleDate = scheduledAt ? new Date(scheduledAt) : new Date();
      
      // Calculate queue delay in milliseconds (same for all profiles)
      const now = Date.now();
      const targetTime = scheduleDate.getTime();
      const delay = Math.max(0, targetTime - now);

      for (const profileId of socialProfileIds) {
        // Verify that the social profile exists and belongs to this company
        const profile = await db
          .select()
          .from(socialProfiles)
          .where(
            and(
              eq(socialProfiles.id, profileId),
              eq(socialProfiles.companyId, companyId)
            )
          )
          .limit(1);

        if (profile.length === 0) {
          continue; // Skip invalid profiles to prevent crash
        }

        // Insert post record for this profile into SQLite
        const newPosts = await db.insert(posts).values({
          companyId,
          socialProfileId: profileId,
          caption,
          mediaUrls: mediaUrls || [],
          status: "scheduled",
          postType: postType || "feed",
          scheduledAt: scheduledAt ? scheduleDate : null,
        }).returning();

        const post = newPosts[0];
        createdPosts.push(post);

        console.log(`⏱️ Queueing post ${post.id} for profile ${profileId} with ${delay}ms delay`);

        // Add to BullMQ with delay and custom job ID
        await postingQueue.add(
          "publish-post",
          { postId: post.id },
          { 
            delay,
            jobId: `post_${post.id}`
          }
        );
      }

      return reply.status(201).send(createdPosts);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to schedule posts" });
    }
  });

  // 2. GET WORKSPACE POSTS (CALENDAR / SCHEDULE LIST)
  fastify.get("/posts", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;

    try {
      const workspacePosts = await db
        .select({
          id: posts.id,
          caption: posts.caption,
          mediaUrls: posts.mediaUrls,
          status: posts.status,
          scheduledAt: posts.scheduledAt,
          publishedAt: posts.publishedAt,
          errorMessage: posts.errorMessage,
          profile: {
            id: socialProfiles.id,
            platform: socialProfiles.platform,
            profileName: socialProfiles.profileName,
          }
        })
        .from(posts)
        .innerJoin(socialProfiles, eq(posts.socialProfileId, socialProfiles.id))
        .where(eq(posts.companyId, companyId))
        .orderBy(desc(posts.scheduledAt));

      return reply.send(workspacePosts);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch workspace posts" });
    }
  });

  // 3. RESCHEDULE A POST'S DATE/TIME (Admin Only)
  fastify.patch("/posts/:postId", { preHandler: [authorizeCompanyAdmin] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;
    const { postId } = request.params as any;
    const { scheduledAt } = request.body as any;

    if (!scheduledAt) {
      return reply.status(400).send({ error: "scheduledAt is required" });
    }

    try {
      const foundPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.id, postId),
            eq(posts.companyId, companyId)
          )
        )
        .limit(1);

      if (foundPosts.length === 0) {
        return reply.status(404).send({ error: "Post not found" });
      }

      const scheduleDate = new Date(scheduledAt);
      const delay = Math.max(0, scheduleDate.getTime() - Date.now());

      // Remove the existing delayed job so it doesn't fire at the old time
      const job = await postingQueue.getJob(`post_${postId}`);
      if (job) {
        await job.remove();
      }

      const updated = await db
        .update(posts)
        .set({ scheduledAt: scheduleDate, status: "scheduled", errorMessage: null })
        .where(eq(posts.id, postId))
        .returning();

      await postingQueue.add(
        "publish-post",
        { postId },
        { delay, jobId: `post_${postId}` }
      );

      return reply.send(updated[0]);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to reschedule post" });
    }
  });

  // 4. CANCEL / DELETE SCHEDULED POST (Admin Only)
  fastify.delete("/posts/:postId", { preHandler: [authorizeCompanyAdmin] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;
    const { postId } = request.params as any;

    try {
      // Find post and verify it belongs to this company
      const foundPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.id, postId),
            eq(posts.companyId, companyId)
          )
        )
        .limit(1);

      if (foundPosts.length === 0) {
        return reply.status(404).send({ error: "Post not found" });
      }

      const post = foundPosts[0];

      // Remove from BullMQ if still active/delayed
      const job = await postingQueue.getJob(`post_${post.id}`);
      if (job) {
        await job.remove();
        console.log(`🧹 Removed delayed job post_${post.id} from BullMQ`);
      }

      // Delete from DB
      await db.delete(posts).where(eq(posts.id, postId));

      return reply.send({ success: true, message: "Scheduled post canceled successfully" });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to cancel post" });
    }
  });
}
