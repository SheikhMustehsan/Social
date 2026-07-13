import { BrowserContext, Page } from "playwright";
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
  maxPostsToCrawl: number = 1 // default to 1 for testing
): Promise<Comment[]> {
  process.env.DISPLAY = ":99";
  
  let rules: any[] = [];
  try {
    rules = await db.select()
      .from(moderationRules)
      .where(
        and(
          eq(moderationRules.companyId, companyId),
          eq(moderationRules.socialProfileId, socialProfileId)
        )
      );
  } catch (e) {
    console.warn("Failed to fetch moderation rules:", e);
  }

  const commentRules = rules.filter(r => r.type === "comment");
  const trackedPostRules = rules.filter(r => r.type === "tracked_post");
  
  const urlsToCrawl: { url: string, isGrid: boolean }[] = [];
  
  // 1. Add explicitly tracked post URLs
  for (const rule of trackedPostRules) {
    if (rule.triggerKeyword && rule.triggerKeyword.startsWith("http")) {
      urlsToCrawl.push({ url: rule.triggerKeyword, isGrid: false });
    }
  }
  
  // 2. Add fallback to main profile page grid
  if (profileUrl) {
    urlsToCrawl.push({ url: profileUrl, isGrid: true });
  }

  const context = await launchBrowserWithProfile(profilePath, { headless: false });
  const page = await context.newPage();
  const allParsedComments: Comment[] = [];

  try {
    for (const target of urlsToCrawl) {
      console.log(`➡️ Comment Crawler: Navigating to ${target.url}...`);
      await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(5000);

      // If we are on the main profile grid, we need to click the 1 most recent post
      if (target.isGrid) {
        let postSelector = "";
        if (platform === "instagram") postSelector = "a[href^='/p/']";
        else if (platform === "facebook") postSelector = "div[data-pagelet='ProfileTimeline'] a[href*='/posts/'], div[data-pagelet='ProfileTimeline'] a[href*='/videos/']";
        else if (platform === "tiktok") postSelector = "div[data-e2e='user-post-item'] a";
        else if (platform === "linkedin") postSelector = "div.feed-shared-update-v2"; 

        if (postSelector) {
           const firstPost = page.locator(postSelector).first();
           if (await firstPost.isVisible()) {
             await firstPost.click();
             console.log(`🖱️ Clicked most recent grid post.`);
             await page.waitForTimeout(4000); // Wait for post modal/page to load
           } else {
             console.log(`⚠️ No posts found on grid for ${platform}. Skipping.`);
             continue; // Skip processing if no posts to click
           }
        }
      }

      // Now we are on a post (either via track URL or clicked from grid)
      // Scroll slightly to trigger comment loading
      // @ts-ignore
      await page.evaluate(() => window.scrollBy(0, 1500));
      await page.waitForTimeout(4000);
      
      let commentsListSelector = "";
      if (platform === "facebook") {
        commentsListSelector = "div[aria-label^='Comment by'][role='article']";
      } else if (platform === "tiktok") {
        commentsListSelector = "div[class*='CommentItemWrapper']";
      } else if (platform === "linkedin") {
        commentsListSelector = "article.comments-comment-item";
      } else {
        commentsListSelector = "ul._a9z6, li._a9zs, ul._a9zs, article"; // Instagram
      }

      const commentNodes = page.locator(commentsListSelector);
      const count = await commentNodes.count();
      console.log(`💬 Found ${count} comment containers on page.`);

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
          if (texts.length > 1) commentText = texts.slice(1).join(" ");
          else if (texts.length === 1 && texts[0] !== authorText) commentText = texts[0];
        } else if (platform === "tiktok") {
          authorText = await node.locator("span[data-e2e='comment-username-1'], span[class*='UserNameText']").first().textContent().catch(() => "") || "";
          commentText = await node.locator("p[data-e2e='comment-level-1'], p[class*='CommentText']").first().textContent().catch(() => "") || "";
        } else if (platform === "linkedin") {
          authorText = await node.locator("span.comments-post-meta__name-text").first().textContent().catch(() => "") || "";
          commentText = await node.locator("div.comments-comment-item__main-content").first().textContent().catch(() => "") || "";
        } else {
          authorText = await node.locator("h3, a._a9zc, strong").first().textContent().catch(() => "") || "";
          commentText = await node.locator("span._ap3a, span").first().textContent().catch(() => "") || "";
        }

        if (authorText && commentText) {
          const commentId = `${authorText.trim()}_${commentText.trim().substring(0, 20)}`;
          allParsedComments.push({ id: commentId, author: authorText.trim(), text: commentText.trim() });
          
          console.log(`  [Comment Found] ${authorText.trim()}: ${commentText.trim()}`);
          
          // Auto-Like action
          let likeBtn = null;
          if (platform === "facebook") likeBtn = node.locator("div[role='button']:has-text('Like'), span:has-text('Like')").first();
          else if (platform === "tiktok") likeBtn = node.locator("div[data-e2e='comment-like-icon']").first();
          else if (platform === "linkedin") likeBtn = node.locator("button.react-button__trigger").first();
          else likeBtn = node.locator("button[aria-label='Like'], svg[aria-label='Like']").first();
          
          if (likeBtn && await likeBtn.isVisible()) {
            await likeBtn.click();
            console.log(`  ❤️ Liked comment from ${authorText.trim()}`);
            await page.waitForTimeout(1000);
          }

          // Determine if we should reply
          let replyToUse = null;
          for (const rule of commentRules) {
            if (rule.triggerKeyword !== "*" && commentText.toLowerCase().includes(rule.triggerKeyword.toLowerCase())) {
              replyToUse = rule.replyText;
              break;
            }
          }
          if (!replyToUse) {
            const fallbackRule = commentRules.find(r => r.triggerKeyword === "*");
            if (fallbackRule) replyToUse = fallbackRule.replyText;
          }

          // Auto-Reply action
          if (replyToUse) {
            let replyBtn = null;
            if (platform === "facebook") replyBtn = node.locator("div[role='button']:has-text('Reply'), span:has-text('Reply')").first();
            else if (platform === "tiktok") replyBtn = node.locator("span:has-text('Reply')").first();
            else if (platform === "linkedin") replyBtn = node.locator("button.comments-comment-social-bar__reply-action").first();
            else replyBtn = node.locator("button:has-text('Reply')").first();
            
            if (replyBtn && await replyBtn.isVisible()) {
              await replyBtn.click();
              await page.waitForTimeout(1000);
              
              let replyInput = null;
              if (platform === "tiktok") replyInput = page.locator("div[data-e2e='comment-input'] div[contenteditable='true']").first();
              else if (platform === "linkedin") replyInput = page.locator("div.ql-editor[contenteditable='true']").first();
              else replyInput = page.locator("textarea[placeholder*='comment'], [role='textbox']").first();
              
              if (replyInput && await replyInput.isVisible()) {
                await replyInput.focus();
                await page.keyboard.insertText(replyToUse);
                await page.waitForTimeout(1000);
                
                let postBtn = null;
                if (platform === "tiktok") postBtn = page.locator("div[data-e2e='comment-post']").first();
                else if (platform === "linkedin") postBtn = page.locator("button.comments-comment-box__submit-button").first();
                else postBtn = page.locator("button:has-text('Post'), button[type='submit']").first();
                
                if (postBtn && await postBtn.isVisible()) {
                  await postBtn.click();
                  console.log(`  ✉️ Replied to comment from ${authorText.trim()}`);
                }
                await page.waitForTimeout(2000);
              }
            }
          }
        }
      }

      // Close modal if on grid
      if (target.isGrid) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1000);
      }
    }

    return allParsedComments;
  } catch (error: any) {
    console.error("❌ Comment Crawler process failed:", error.message);
    throw error;
  } finally {
    await context.close();
  }
}
