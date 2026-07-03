import { FastifyInstance } from "fastify";
import { db } from "../../db/db.js";
import { adsAnalytics, socialAnalytics } from "../../db/schema.js";
import { authenticate, authorizeCompanyAccess } from "../middleware/auth.js";
import { eq, and, sql } from "drizzle-orm";

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
}
