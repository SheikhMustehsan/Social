import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import crypto from "crypto";

// 1. Users Table
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  globalRole: text("global_role").default("member").notNull(), // 'super_admin' or 'member'
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 2. Companies (Workspaces) Table
export const companies = sqliteTable("companies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 3. Company Members Table (Joint table for Team access controls)
export const companyMembers = sqliteTable("company_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").default("editor").notNull(), // 'admin', 'editor', 'viewer'
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 4. Social Profiles Table
export const socialProfiles = sqliteTable("social_profiles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  platform: text("platform").notNull(), // 'facebook', 'instagram', 'linkedin', 'tiktok'
  profileName: text("profile_name").notNull(),
  profileId: text("profile_id"), // External ID from the social platform
  adAccountId: text("ad_account_id"), // Associated Ad Account ID for pulling ads analytics
  chromeProfilePath: text("chrome_profile_path").notNull(), // Path to persistent browser context
  status: text("status").default("connected").notNull(), // 'connected', 'error'
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 5. Posts Table (Scheduler queue)
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  socialProfileId: text("social_profile_id")
    .references(() => socialProfiles.id, { onDelete: "cascade" })
    .notNull(),
  caption: text("caption"),
  mediaUrls: text("media_urls", { mode: "json" }).$defaultFn(() => []).notNull(), // SQLite Mode JSON to store string array
  status: text("status").default("draft").notNull(), // 'draft', 'scheduled', 'publishing', 'published', 'failed'
  postType: text("post_type").default("feed").notNull(), // 'feed' or 'story'
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 6. Social Organic Analytics Table
export const socialAnalytics = sqliteTable("social_analytics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  socialProfileId: text("social_profile_id")
    .references(() => socialProfiles.id, { onDelete: "cascade" })
    .notNull(),
  date: integer("date", { mode: "timestamp" }).notNull(),
  followersCount: integer("followers_count").default(0).notNull(),
  reachCount: integer("reach_count").default(0).notNull(),
  engagementCount: integer("engagement_count").default(0).notNull(),
  postsCount: integer("posts_count").default(0).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 7. Ads Analytics Table
export const adsAnalytics = sqliteTable("ads_analytics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  platform: text("platform").notNull(), // 'meta', 'tiktok', 'google', 'linkedin'
  campaignName: text("campaign_name").notNull(),
  campaignId: text("campaign_id"),
  date: integer("date", { mode: "timestamp" }).notNull(),
  spend: real("spend").default(0).notNull(),
  impressions: integer("impressions").default(0).notNull(),
  clicks: integer("clicks").default(0).notNull(),
  conversions: integer("conversions").default(0).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// --- RELATION DEFINITIONS FOR DRIZZLE ORM ---

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(companyMembers),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  members: many(companyMembers),
  socialProfiles: many(socialProfiles),
  posts: many(posts),
  socialAnalytics: many(socialAnalytics),
  adsAnalytics: many(adsAnalytics),
}));

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  company: one(companies, {
    fields: [companyMembers.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyMembers.userId],
    references: [users.id],
  }),
}));

export const socialProfilesRelations = relations(socialProfiles, ({ one, many }) => ({
  company: one(companies, {
    fields: [socialProfiles.companyId],
    references: [companies.id],
  }),
  posts: many(posts),
  analytics: many(socialAnalytics),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  company: one(companies, {
    fields: [posts.companyId],
    references: [companies.id],
  }),
  socialProfile: one(socialProfiles, {
    fields: [posts.socialProfileId],
    references: [socialProfiles.id],
  }),
}));

export const socialAnalyticsRelations = relations(socialAnalytics, ({ one }) => ({
  company: one(companies, {
    fields: [socialAnalytics.companyId],
    references: [companies.id],
  }),
  socialProfile: one(socialProfiles, {
    fields: [socialAnalytics.socialProfileId],
    references: [socialProfiles.id],
  }),
}));

export const adsAnalyticsRelations = relations(adsAnalytics, ({ one }) => ({
  company: one(companies, {
    fields: [adsAnalytics.companyId],
    references: [companies.id],
  }),
}));
