import { BrowserContext, Page } from "playwright";
import { launchBrowserWithProfile } from "../utils/browserLauncher.js";
import path from "path";
import fs from "fs";
import { db } from "../../db/db.js";
import { moderationRules } from "../../db/schema.js";
import { eq, and, or, isNull } from "drizzle-orm";

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
  maxPostsToCrawl: number = 1, // default to 1 for testing
  modelName: string = "moondream"
): Promise<Comment[]> {
  process.env.DISPLAY = ":99";
  
  let rules: any[] = [];
  try {
    rules = await db.select()
      .from(moderationRules)
      .where(
        and(
          eq(moderationRules.companyId, companyId),
          or(
            eq(moderationRules.socialProfileId, socialProfileId),
            isNull(moderationRules.socialProfileId)
          )
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
    const isGrid = !profileUrl.includes('/video/') && 
                   !profileUrl.includes('/posts/') && 
                   !profileUrl.includes('/p/') && 
                   !profileUrl.includes('/feed/update/');
    urlsToCrawl.push({ url: profileUrl, isGrid });
  }

  const context = await launchBrowserWithProfile(profilePath, { headless: false });
  const page = await context.newPage();
  const allParsedComments: Comment[] = [];

  try {
    for (const target of urlsToCrawl) {
      // Auto-fix URLs with spaces
      if (target.url.includes(" ")) {
        target.url = target.url.replace(/\s+/g, "");
      }
      
      console.log(`➡️ Comment Crawler: Navigating to ${target.url}...`);
      await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(5000);

      // If we are on the main profile grid, we need to click the 1 most recent post
      if (target.isGrid) {
        let postSelector = "";
        if (platform === "instagram") postSelector = "a[href^='/p/'], a[href*='/reel/']";
        else if (platform === "facebook") postSelector = "div[role='article'] a[href*='/posts/'], div[role='article'] a[href*='/videos/'], a[href*='/posts/'], a[href*='/videos/']";
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

      // Close common login popups that obscure the screen
      try {
         console.log(`🧹 Attempting to close any login popups...`);
         const closeBtns = page.locator('button[aria-label="Dismiss"], svg[aria-label="Close"], div[role="button"][aria-label="Close"], button.icon-close');
         if (await closeBtns.count() > 0) {
            await closeBtns.first().click({ force: true });
            await page.waitForTimeout(1000);
         }
      } catch (e) {}

      // Try to open comments if they are hidden
      try {
         if (platform === "tiktok") {
            await page.locator('div[data-e2e="comment-icon"]').first().click({ timeout: 2000 });
            await page.waitForTimeout(2000);
         }
      } catch (e) {
         console.log(`Failed to click open comments: ${(e as Error).message}`);
      }

      console.log(`🔄 Scrolling to load comments for 5 seconds...`);
      const startTime = Date.now();
      while (Date.now() - startTime < 5000) {
         await page.evaluate(() => {
            window.scrollBy(0, 1000);
            const scrollable = Array.from(document.querySelectorAll('div')).filter(el => {
               const style = window.getComputedStyle(el);
               return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
            });
            scrollable.forEach(div => div.scrollBy(0, 1000));
         });
         await page.waitForTimeout(1000);
      }

      console.log(`🤖 Extracting comments via DOM for ${platform}...`);
      
      let extractedComments: { author: string, text: string }[] = [];
      try {
         extractedComments = await page.evaluate((plat) => {
            const comments: { author: string, text: string }[] = [];
            const docAny = (globalThis as any).document;

            if (plat === "tiktok") {
               const commentNodes = docAny.querySelectorAll('div[data-e2e="comment-level-1"], div[class*="DivCommentItemContainer"]');
               commentNodes.forEach((node: any) => {
                  const author = node.querySelector('span[class*="SpanUserNameText"], a[class*="StyledUserLinkName"]')?.textContent?.trim() || "Unknown";
                  const text = node.querySelector('p[data-e2e="comment-level-1-text"], p[class*="PCommentText"]')?.textContent?.trim() || "";
                  if (text) comments.push({ author, text });
               });
            } else if (plat === "instagram") {
               const commentNodes = docAny.querySelectorAll('ul.x1qjc9v5 li, div.x1n2onr6[role="listitem"], div.x9f619[role="listitem"]');
               commentNodes.forEach((node: any) => {
                  const authorNode = node.querySelector('h3, a.x1i10hfl');
                  const author = authorNode ? authorNode.textContent?.trim() : "Unknown";
                  const spans = Array.from(node.querySelectorAll('span[dir="auto"]'));
                  const textNode = spans.find((s: any) => s.textContent !== author && s.textContent !== "Verified");
                  const text = textNode ? (textNode as any).textContent?.trim() : "";
                  if (text && author !== "Unknown") comments.push({ author, text });
               });
            } else if (plat === "linkedin") {
               const commentNodes = docAny.querySelectorAll('article.comments-comment-item, article.comments-comments-list__comment-item, .comment__body, .comment');
               commentNodes.forEach((node: any) => {
                  const author = node.querySelector('.comments-post-meta__name-text span[aria-hidden="true"], span.comments-post-meta__name-text.hoverable-link-text, .comment__author, span.truncate')?.textContent?.trim() || "Unknown";
                  const text = node.querySelector('.comments-comment-item__main-content, .update-components-text, .comment__text, p[dir="ltr"]')?.textContent?.trim() || "";
                  if (text) comments.push({ author, text });
               });
            }
            return comments;
         }, platform);
         
         if (extractedComments.length === 0) {
            console.log(`⚠️ No comments found, dumping debug files...`);
            await page.screenshot({ path: `debug_${platform}.png` });
            const html = await page.content();
            const fs = await import("fs");
            fs.writeFileSync(`debug_${platform}.html`, html);
         }

         // Deduplicate
         const uniqueComments = new Map();
         for (const c of extractedComments) {
            uniqueComments.set(c.author + "_" + c.text, c);
         }
         extractedComments = Array.from(uniqueComments.values());
         
         console.log(`✅ DOM Extracted ${extractedComments.length} comments.`);
         console.log("Raw JSON:", extractedComments);
      } catch (err) {
         console.error("❌ Failed to extract comments via DOM:", err);
      }

      for (const comment of extractedComments) {
        const authorText = comment.author;
        const commentText = comment.text;

        if (!authorText || !commentText) continue;

        const commentId = `${authorText.trim()}_${commentText.trim().substring(0, 20)}`;
        allParsedComments.push({ id: commentId, author: authorText.trim(), text: commentText.trim() });
        
        console.log(`  [AI Comment Found] ${authorText.trim()}: ${commentText.trim()}`);
        
        // Determine if we should reply
        let replyToUse = null;
        for (const rule of commentRules) {
          if (rule.triggerKeyword !== "*") {
            const keywords = rule.triggerKeyword.split(",").map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0);
            const lowerComment = commentText.toLowerCase();
            if (keywords.some((k: string) => lowerComment.includes(k))) {
              replyToUse = rule.replyText;
              break;
            }
          }
        }
        if (!replyToUse) {
          const fallbackRule = commentRules.find(r => r.triggerKeyword === "*");
          if (fallbackRule) replyToUse = fallbackRule.replyText;
        }

        // Auto-Reply action using visual/text locators
        if (replyToUse) {
          console.log(`  🔍 Locating comment by ${authorText} in DOM to reply...`);
          let replied = false;
          try {
             // Find a container that holds both the author's name and a reply button
             // We start by looking for standard comment wrappers, and filter by the author's name
             const commentWrappers = page.locator('article, .comment, .comments-comment-item, [data-testid="comment"], .feed-shared-comment');
             const specificComment = commentWrappers.filter({ hasText: authorText.trim() }).last();
             
             if (await specificComment.isVisible().catch(() => false)) {
                 const replyBtn = specificComment.locator('button:has-text("Reply"), span:has-text("Reply"), div:has-text("Reply")').locator('visible=true').first();
                 if (await replyBtn.isVisible().catch(() => false)) {
                     await replyBtn.click();
                     replied = true;
                 }
             }
             
             // Fallback if the wrapper wasn't found
             if (!replied) {
                 const genericReplyBtn = page.locator(`text="${authorText.trim()}"`).locator('xpath=ancestor::*[contains(@class, "comment") or name()="article"][1]').locator('button:has-text("Reply"), span:has-text("Reply")').first();
                 if (await genericReplyBtn.isVisible().catch(() => false)) {
                     await genericReplyBtn.click();
                     replied = true;
                 }
             }

             if (replied) {
                 await page.waitForTimeout(1500); // wait for box to open
                 const inputBox = page.locator('div[contenteditable="true"], .ql-editor, textarea, input[type="text"]').last();
                 if (await inputBox.isVisible().catch(() => false)) {
                     await inputBox.focus();
                 }
             }
          } catch (e) {
             console.log(`  ⚠️ Error clicking reply: ${e}`);
          }

          if (replied) {
            await page.waitForTimeout(1000);
            await page.keyboard.insertText(replyToUse);
            await page.waitForTimeout(1000);
            
            await page.screenshot({ path: `debug_reply_${authorText.replace(/[^a-zA-Z0-9]/g, '')}.png` });
            
            const postBtn = page.locator('button.comments-comment-box__submit-button, button.artdeco-button--primary:has-text("Post"), button:has-text("Reply")').last();
            if (await postBtn.isVisible().catch(() => false)) {
              await postBtn.click({ force: true }).catch(() => {});
            } else {
               await page.keyboard.press("Enter");
            }
            console.log(`  ✉️ Automated Rule-based reply posted to ${authorText.trim()}`);
            await page.waitForTimeout(2000);
          } else {
            console.log(`  ⚠️ Could not click reply button for ${authorText.trim()}. (Note: If testing on a signed-out profile, you cannot reply)`);
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
