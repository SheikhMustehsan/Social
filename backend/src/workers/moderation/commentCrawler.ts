import { BrowserContext } from "playwright";
import { launchBrowserWithProfile } from "../utils/browserLauncher.js";
import path from "path";
import fs from "fs";
import { db } from "../../db/db.js";
import { moderationRules } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

interface Comment {
  id: string;
  author: string;
  text: string;
}

export async function crawlAndReplyComments(
  profilePath: string,
  profileUrl: string,
  socialProfileId: string,
  companyId: string,
  platform: string,
  maxPostsToCrawl: number = 3
): Promise<Comment[]> {
  process.env.DISPLAY = ":99";
  
  let rules: any[] = [];
  try {
    // Assuming socialProfileId is needed, normally passed as an arg or derived
    rules = await db.select()
      .from(moderationRules)
      .where(
        and(
          eq(moderationRules.type, "comment"),
          eq(moderationRules.companyId, companyId),
          eq(moderationRules.socialProfileId, socialProfileId)
        )
      );
  } catch (e) {
    console.warn("Failed to fetch moderation rules:", e);
  }

  const context = await launchBrowserWithProfile(profilePath, { headless: false });
  const page = await context.newPage();
  
  try {
    console.log(`➡️ Comment Crawler: Navigating to ${profileUrl}...`);
    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);
    
    // Scroll a bit to trigger lazy loading of posts and comments
    await page.evaluate(() => window.scrollBy(0, 1500));
    await page.waitForTimeout(4000);
    // Instagram/Facebook post comment parsing
    let commentsListSelector = "";
    if (platform === "facebook") {
      commentsListSelector = "div[aria-label^='Comment by'][role='article']";
    } else {
      commentsListSelector = "ul._a9z6, li._a9zs, ul._a9zs, article"; // Instagram
    }
    const commentNodes = page.locator(commentsListSelector);
    const count = await commentNodes.count();
    
    console.log(`💬 Found ${count} comment containers on page.`);
    const parsedComments: Comment[] = [];

    // Loop through comments
    for (let i = 0; i < Math.min(count, 15); i++) {
      const node = commentNodes.nth(i);
      
      let authorText = "";
      let commentText = "";

      if (platform === "facebook") {
        const ariaLabel = await node.getAttribute('aria-label').catch(() => null);
        if (ariaLabel && ariaLabel.startsWith("Comment by")) {
          authorText = ariaLabel.replace("Comment by ", "").split(/( \d+ (minute|hour|day|week|month|year)s? ago)/)[0].trim();
        }
        const texts = await node.locator("div[dir='auto']").allTextContents().catch(() => []);
        if (texts.length > 1) {
          commentText = texts.slice(1).join(" ");
        } else if (texts.length === 1 && texts[0] !== authorText) {
          commentText = texts[0];
        }
      } else {
        // Instagram parsing
        authorText = await node.locator("h3, a._a9zc, strong").first().textContent().catch(() => "") || "";
        commentText = await node.locator("span._ap3a, span").first().textContent().catch(() => "") || "";
      }

      if (authorText && commentText) {
        const commentId = `${authorText.trim()}_${commentText.trim().substring(0, 20)}`;
        parsedComments.push({
          id: commentId,
          author: authorText.trim(),
          text: commentText.trim()
        });

        // Simulating checking if new and auto-moderating
        console.log(`  [Comment Found] ${authorText.trim()}: ${commentText.trim()}`);
        
        // Auto-Like action
        if (true) { // TODO: pass likeNewComments as an arg if needed later
          // Find like button within this comment container
          const likeBtn = platform === "facebook" 
            ? node.locator("div[role='button']:has-text('Like'), span:has-text('Like')").first()
            : node.locator("button[aria-label='Like'], svg[aria-label='Like']").first();
          if (await likeBtn.isVisible()) {
            await likeBtn.click();
            console.log(`  ❤️ Liked comment from ${authorText.trim()}`);
            await page.waitForTimeout(1000);
          }
        }

        // Determine if we should reply based on rules
        let replyToUse = null;
        for (const rule of rules) {
          if (rule.triggerKeyword !== "*" && commentText.toLowerCase().includes(rule.triggerKeyword.toLowerCase())) {
            replyToUse = rule.replyText;
            break;
          }
        }
        if (!replyToUse) {
          const fallbackRule = rules.find(r => r.triggerKeyword === "*");
          if (fallbackRule) replyToUse = fallbackRule.replyText;
        }

        // Auto-Reply action
        if (replyToUse) {
          const replyBtn = platform === "facebook"
            ? node.locator("div[role='button']:has-text('Reply'), span:has-text('Reply')").first()
            : node.locator("button:has-text('Reply')").first();
          if (await replyBtn.isVisible()) {
            await replyBtn.click();
            await page.waitForTimeout(1000);
            
            // Wait for input textarea/box to focus
            const replyInput = page.locator("textarea[placeholder*='comment'], [role='textbox']").first();
            if (await replyInput.isVisible()) {
              await replyInput.focus();
              await page.keyboard.insertText(replyToUse);
              await page.waitForTimeout(1000);
              
              // Click post button
              const postBtn = page.locator("button:has-text('Post'), button[type='submit']").first();
              await postBtn.click();
              console.log(`  ✉️ Replied to comment from ${authorText.trim()}`);
              await page.waitForTimeout(2000);
            }
          }
        }
      }
    }

    return parsedComments;
  } catch (error: any) {
    console.error("❌ Comment Crawler process failed:", error.message);
    throw error;
  } finally {
    await context.close();
  }
}
