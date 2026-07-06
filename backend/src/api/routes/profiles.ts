import { FastifyInstance } from "fastify";
import { db } from "../../db/db.js";
import { socialProfiles } from "../../db/schema.js";
import { authenticate, authorizeCompanyAccess, authorizeCompanyAdmin } from "../middleware/auth.js";
import { eq, and } from "drizzle-orm";
import { launchBrowserWithProfile } from "../../workers/utils/browserLauncher.js";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export async function profileRoutes(fastify: FastifyInstance) {
  // Protect all profile endpoints with authentication
  fastify.addHook("preHandler", authenticate);

  // 0. AUTO-DISCOVER LOCAL CHROME PROFILES
  fastify.get("/discover", async (request, reply) => {
    let userDataDir = "";
    const platform = os.platform();

    // Resolve Chrome's default User Data folder based on OS
    if (platform === "win32") {
      userDataDir = path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/User Data");
    } else if (platform === "darwin") {
      userDataDir = path.join(os.homedir(), "Library/Application Support/Google/Chrome");
    } else {
      userDataDir = path.join(os.homedir(), ".config/google-chrome");
    }

    if (!fs.existsSync(userDataDir)) {
      return reply.send([]);
    }

    try {
      const discoveredProfiles = [];
      const items = fs.readdirSync(userDataDir);

      for (const item of items) {
        // Chrome profiles are named 'Default' or 'Profile [number]'
        if (item === "Default" || item.startsWith("Profile ")) {
          const profilePath = path.join(userDataDir, item);
          const preferencesPath = path.join(profilePath, "Preferences");

          if (fs.existsSync(preferencesPath)) {
            try {
              const content = fs.readFileSync(preferencesPath, "utf-8");
              const json = JSON.parse(content);
              
              const profileName = json.profile?.name || item;
              let email = "";
              
              // Extract sign-in email if available
              if (json.account_info && Array.isArray(json.account_info) && json.account_info.length > 0) {
                email = json.account_info[0].email || "";
              } else if (json.profile?.email) {
                email = json.profile.email;
              }

              discoveredProfiles.push({
                name: profileName,
                email,
                path: profilePath,
              });
            } catch (e) {
              // Fallback if preferences file is currently locked/unreadable
              discoveredProfiles.push({
                name: item,
                email: "Logged In Context",
                path: profilePath,
              });
            }
          }
        }
      }

      return reply.send(discoveredProfiles);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to scan local Chrome profiles" });
    }
  });

  // 0.1 LAUNCH LOGIN BROWSER WINDOW FOR ACTIVE CONTEXT
  fastify.post("/launch-browser", { preHandler: [authorizeCompanyAdmin] }, async (request, reply) => {
    const { chromeProfilePath, platform } = request.body as any;

    // Generate server-side persistent profile path if none is supplied
    let targetProfilePath = chromeProfilePath;
    if (!targetProfilePath) {
      const sessionDir = path.join(process.cwd(), "data", "sessions");
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      targetProfilePath = path.join(sessionDir, `session_${crypto.randomUUID()}`);
    }

    try {
      console.log(`🖥️ Spawning headed browser session for: ${targetProfilePath}`);
      const context = await launchBrowserWithProfile(targetProfilePath, { headless: false });
      const page = await context.newPage();

      // Resolve starting URL based on selected social profile platform
      let targetUrl = "https://www.google.com";
      if (platform === "facebook") targetUrl = "https://www.facebook.com";
      else if (platform === "instagram") targetUrl = "https://www.instagram.com";
      else if (platform === "linkedin") targetUrl = "https://www.linkedin.com";
      else if (platform === "tiktok") targetUrl = "https://www.tiktok.com";

      await page.goto(targetUrl);

      // Block response until user manually closes the Chromium browser window
      await new Promise<void>((resolve) => {
        context.on("close", () => {
          resolve();
        });
      });

      console.log(`🏁 Headed login browser closed. Profile session cookies synchronized.`);
      return reply.send({ 
        status: "success", 
        message: "Browser closed and session updated.", 
        chromeProfilePath: targetProfilePath 
      });
    } catch (error: any) {
      fastify.log.error(error);
      
      // Check if it's a closed context error
      if (error.message && error.message.includes("Target page, context or browser has been closed")) {
        return reply.send({ status: "success", message: "Browser closed.", chromeProfilePath: targetProfilePath });
      }

      return reply.status(500).send({ 
        error: "Failed to open login browser. If Google Chrome is currently open, please close all Google Chrome windows and try again." 
      });
    }
  });

  // 1. CONNECT / ADD A NEW SOCIAL PROFILE (Admin Only)
  fastify.post("/", { preHandler: [authorizeCompanyAdmin] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;
    const { platform, profileName, chromeProfilePath } = request.body as any;

    if (!platform || !profileName || !chromeProfilePath) {
      return reply.status(400).send({ 
        error: "Missing required fields: platform, profileName, and chromeProfilePath are required." 
      });
    }

    if (!["facebook", "instagram", "linkedin", "tiktok"].includes(platform)) {
      return reply.status(400).send({ error: "Invalid platform. Must be 'facebook', 'instagram', 'linkedin', or 'tiktok'" });
    }

    try {
      const newProfiles = await db.insert(socialProfiles).values({
        companyId,
        platform,
        profileName,
        chromeProfilePath,
        status: "connected",
      }).returning();

      return reply.status(201).send(newProfiles[0]);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to connect profile" });
    }
  });

  // 2. LIST ALL CONNECTED PROFILES FOR A WORKSPACE
  fastify.get("/", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;

    try {
      const profiles = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.companyId, companyId));

      return reply.send(profiles);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch social profiles" });
    }
  });

  // 3. REMOVE A CONNECTED PROFILE (Admin Only)
  fastify.delete("/:profileId", { preHandler: [authorizeCompanyAdmin] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;
    const { profileId } = request.params as any;

    try {
      const deleted = await db
        .delete(socialProfiles)
        .where(
          and(
            eq(socialProfiles.id, profileId),
            eq(socialProfiles.companyId, companyId)
          )
        );

      return reply.send({ success: true, message: "Profile disconnected successfully" });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to disconnect profile" });
    }
  });
}
