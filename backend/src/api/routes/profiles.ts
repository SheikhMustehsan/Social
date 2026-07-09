import { FastifyInstance } from "fastify";
import { db } from "../../db/db.js";
import { socialProfiles } from "../../db/schema.js";
import { authenticate, authorizeCompanyAccess, authorizeCompanyAdmin } from "../middleware/auth.js";
import { browserQueue } from "../../queue/queue.js";
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
      // Ensure Xvfb display is targeted
      process.env.DISPLAY = ":99";
      const context = await launchBrowserWithProfile(targetProfilePath, { headless: false });
      const page = await context.newPage();

      // Resolve starting URL based on selected social profile platform
      let targetUrl = "https://www.google.com";
      if (platform === "facebook") targetUrl = "https://www.facebook.com";
      else if (platform === "instagram") targetUrl = "https://www.instagram.com";
      else if (platform === "linkedin") targetUrl = "https://www.linkedin.com";
      else if (platform === "tiktok") targetUrl = "https://www.tiktok.com";
      page.goto(targetUrl).catch((e) => console.log(`Navigation to ${targetUrl} issue:`, e.message));

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

  // 0.2 UPLOAD A SESSION FILE CAPTURED LOCALLY (Admin Only)
  // This server has no display of its own, so a headed browser login can't run here.
  // Instead, an admin logs in on their own machine (via scripts/captureSession.ts), which
  // saves a Playwright storageState (cookies + localStorage) as JSON, and uploads it here.
  fastify.post("/upload-session", { preHandler: [authorizeCompanyAdmin] }, async (request, reply) => {
    if (!request.isMultipart()) {
      return reply.status(400).send({ error: "Request is not multipart. Please upload the session file as multipart/form-data." });
    }

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "No session file was uploaded." });
      }

      const sessionsDir = path.join(process.cwd(), "data", "sessions");
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }

      const isZip = data.filename.toLowerCase().endsWith(".zip");
      const uuid = crypto.randomUUID();
      const tempFilename = isZip ? `session_${uuid}.zip` : `session_${uuid}.json`;
      const destPath = path.join(sessionsDir, tempFilename);
      const writeStream = fs.createWriteStream(destPath);

      await new Promise<void>((resolve, reject) => {
        data.file.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        data.file.on("error", (err) => {
          writeStream.destroy();
          reject(err);
        });
      });

      if (isZip) {
        const extractDir = path.join(sessionsDir, `session_${uuid}`);
        fs.mkdirSync(extractDir, { recursive: true });

        try {
          const { execSync } = await import("child_process");
          console.log(`📦 Unzipping profile archive to: ${extractDir}`);
          // Extract using native Linux unzip command
          execSync(`unzip -o "${destPath}" -d "${extractDir}"`);
          console.log(`✅ Unzipped successfully.`);
          
          // Delete temp zip
          fs.unlinkSync(destPath);
          return reply.send({ sessionPath: extractDir });
        } catch (err: any) {
          console.error("❌ Failed to unzip profile:", err.message);
          try { fs.unlinkSync(destPath); } catch {}
          try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
          return reply.status(400).send({ error: "Failed to unzip the uploaded browser profile: " + err.message });
        }
      } else {
        // Sanity check: make sure this is actually a storageState JSON, not a random file
        try {
          const parsed = JSON.parse(fs.readFileSync(destPath, "utf-8"));
          if (!parsed || !Array.isArray(parsed.cookies)) {
            fs.unlinkSync(destPath);
            return reply.status(400).send({ error: "That file doesn't look like a valid session export (missing 'cookies' array)." });
          }
        } catch {
          fs.unlinkSync(destPath);
          return reply.status(400).send({ error: "Uploaded file is not valid JSON. Make sure you're uploading the file saved by captureSession.ts." });
        }

        console.log(`📥 Session file uploaded and saved to: ${destPath}`);
        return reply.send({ sessionPath: destPath });
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to save uploaded session file." });
    }
  });

  // 1. CONNECT / ADD A NEW SOCIAL PROFILE (Admin Only)
  fastify.post("/", { preHandler: [authorizeCompanyAdmin] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;
    const { platform, profileName, chromeProfilePath, profileId } = request.body as any;

    if (!platform || !profileName || !chromeProfilePath) {
      return reply.status(400).send({
        error: "Missing required fields: platform, profileName, and chromeProfilePath are required."
      });
    }

    if (!["facebook", "instagram", "linkedin", "tiktok"].includes(platform)) {
      return reply.status(400).send({ error: "Invalid platform. Must be 'facebook', 'instagram', 'linkedin', or 'tiktok'" });
    }

    // Facebook Pages and LinkedIn Company Pages require an explicit target, since one
    // logged-in account can administer many pages. Instagram/TikTok log in as a single
    // account, so there's nothing to disambiguate.
    if ((platform === "facebook" || platform === "linkedin") && !profileId) {
      return reply.status(400).send({
        error: platform === "facebook"
          ? "The exact Facebook Page name is required so the bot knows which Page to post to."
          : "The LinkedIn Company Page URL or ID is required so the bot knows which Page to post to."
      });
    }

    try {
      const newProfiles = await db.insert(socialProfiles).values({
        companyId,
        platform,
        profileName,
        chromeProfilePath,
        profileId: profileId || null,
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

  // 7. SYNC DMS (QUEUE JOB)
  fastify.post("/sync-dms", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;

    try {
      const profilesToScrape = await db
        .select()
        .from(socialProfiles)
        .where(
          and(
            eq(socialProfiles.companyId, companyId),
            eq(socialProfiles.status, "connected")
          )
        );

      if (profilesToScrape.length === 0) {
        return reply.status(400).send({ error: "No connected profiles found." });
      }

      const queuedJobs = [];

      for (const profile of profilesToScrape) {
        const jobId = `scan_dms_${profile.id}_${Date.now()}`;
        const job = await browserQueue.add(
          jobId,
          {
            type: "scan_dms",
            profileId: profile.id
          },
          { jobId }
        );
        queuedJobs.push({ profileId: profile.id, platform: profile.platform, jobId: job.id });
      }

      return reply.send({ message: "DM sync triggered successfully", queuedJobs });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to trigger DM sync" });
    }
  });

  // 8. SYNC COMMENTS (QUEUE JOB)
  fastify.post("/sync-comments", { preHandler: [authorizeCompanyAccess] }, async (request, reply) => {
    const companyId = request.headers["x-company-id"] as string;

    try {
      const profilesToScrape = await db
        .select()
        .from(socialProfiles)
        .where(
          and(
            eq(socialProfiles.companyId, companyId),
            eq(socialProfiles.status, "connected")
          )
        );

      if (profilesToScrape.length === 0) {
        return reply.status(400).send({ error: "No connected profiles found." });
      }

      const queuedJobs = [];

      for (const profile of profilesToScrape) {
        const jobId = `crawl_comments_${profile.id}_${Date.now()}`;
        const job = await browserQueue.add(
          jobId,
          {
            type: "crawl_comments",
            profileId: profile.id
          },
          { jobId }
        );
        queuedJobs.push({ profileId: profile.id, platform: profile.platform, jobId: job.id });
      }

      return reply.send({ message: "Comment sync triggered successfully", queuedJobs });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to trigger comment sync" });
    }
  });
}
