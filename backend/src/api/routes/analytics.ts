import { FastifyInstance } from "fastify";
import { db } from "../../db/db.js";
import { adsAnalytics, socialAnalytics } from "../../db/schema.js";
import { authenticate, authorizeCompanyAccess } from "../middleware/auth.js";
import { eq, and, sql, isNotNull } from "drizzle-orm";
import { browserQueue } from "../../queue/queue.js";

export async function analyticsRoutes(fastify: FastifyInstance) {
  // Protect all analytics endpoints with authentication
  fastify.addHook("preHandler", authenticate);

  // 1. GET ADS ANALYTICS DETAIL
  fastify.get("/ads", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;

    try {
      // Group ads performance metrics by campaign and platform
      const campaignsPerformance = await db
        .select({
          campaignName: adsAnalytics.campaignName,
          platform: adsAnalytics.platform,
          totalSpend: sql<number>`SUM(CAST(${adsAnalytics.spend} AS REAL))`,
          totalImpressions: sql<number>`SUM(${adsAnalytics.impressions})`,
          totalClicks: sql<number>`SUM(${adsAnalytics.clicks})`,
          totalConversions: sql<number>`SUM(${adsAnalytics.conversions})`,
        })
        .from(adsAnalytics)
        .where(eq(adsAnalytics.companyId, companyId))
        .groupBy(adsAnalytics.campaignName, adsAnalytics.platform);

      return reply.send(campaignsPerformance);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch ads performance metrics" });
    }
  });

  // 2. GET AGGREGATE SUMMARY (METRIC CARDS)
  fastify.get("/summary", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;

    try {
      // Fetch aggregate metrics
      const [totals] = await db
        .select({
          totalSpend: sql<number>`COALESCE(SUM(CAST(${adsAnalytics.spend} AS REAL)), 0)`,
          totalImpressions: sql<number>`COALESCE(SUM(${adsAnalytics.impressions}), 0)`,
          totalClicks: sql<number>`COALESCE(SUM(${adsAnalytics.clicks}), 0)`,
          totalConversions: sql<number>`COALESCE(SUM(${adsAnalytics.conversions}), 0)`,
        })
        .from(adsAnalytics)
        .where(eq(adsAnalytics.companyId, companyId));

      const totalClicks = totals.totalClicks || 0;
      const totalSpend = totals.totalSpend || 0;
      const totalImpressions = totals.totalImpressions || 0;

      // Calculate averages safely
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

      return reply.send({
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions: totals.totalConversions || 0,
        ctr: parseFloat(ctr.toFixed(2)),
        cpc: parseFloat(cpc.toFixed(2)),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to compile analytics summary" });
    }
  });

  // 3. TRIGGER ADS SYNC (SCRAPE)
  fastify.post("/sync-ads", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;
    const { dateRange = "last_30_days" } = request.body as { dateRange?: string } || {};

    try {
      // Find all connected profiles for this company that have an adAccountId
      const profilesToScrape = await db
        .select()
        .from(socialProfiles)
        .where(
          and(
            eq(socialProfiles.companyId, companyId),
            eq(socialProfiles.status, "connected"),
            isNotNull(socialProfiles.adAccountId)
          )
        );

      if (profilesToScrape.length === 0) {
        return reply.status(400).send({ error: "No connected profiles with an Ad Account ID found." });
      }

      const queuedJobs = [];

      // Queue a job for each eligible profile
      for (const profile of profilesToScrape) {
        const jobId = `scrape_ads_${profile.id}_${Date.now()}`;
        const job = await browserQueue.add(
          jobId,
          {
            type: "scrape_ads",
            profileId: profile.id,
            dateRange
          },
          {
            jobId,
            attempts: 1, // Don't retry headless scrapers immediately on failure to prevent rate limits
          }
        );
        queuedJobs.push({ profileId: profile.id, platform: profile.platform, jobId: job.id });
      }

      return reply.send({ message: "Ads sync triggered successfully", queuedJobs });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to trigger ads sync" });
    }
  });
}
