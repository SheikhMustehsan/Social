import { BrowserContext } from "playwright";
import { launchBrowserWithProfile } from "../utils/browserLauncher.js";
import path from "path";
import fs from "fs";

interface Comment {
  id: string;
  author: string;
  text: string;
}

export async function crawlAndReplyComments(
  profilePath: string,
  postUrl: string,
  autoReplyText: string = "Thank you for your comment! Check your DMs.",
  likeNewComments: boolean = true
): Promise<Comment[]> {
  process.env.DISPLAY = ":99";
  const context = await launchBrowserWithProfile(profilePath, { headless: false });
  const page = await context.newPage();
  
  try {
    console.log(`➡️ Comment Crawler: Navigating to ${postUrl}...`);
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);

    // Instagram/Facebook post comment parsing
    // Locate comment items (Instagram comment structure usually uses article tags or list items inside comments section)
    const commentsListSelector = "ul._a9z6, li._a9zs, ul._a9zs, article"; // Generic class matches for Instagram comments
    const commentNodes = page.locator(commentsListSelector);
    const count = await commentNodes.count();
    
    console.log(`💬 Found ${count} comment containers on page.`);
    const parsedComments: Comment[] = [];

    // Loop through comments
    for (let i = 0; i < Math.min(count, 15); i++) {
      const node = commentNodes.nth(i);
      
      // Extract author name and comment text
      const authorText = await node.locator("h3, a._a9zc, strong").first().textContent().catch(() => "");
      const commentText = await node.locator("span._ap3a, span").first().textContent().catch(() => "");

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
        if (likeNewComments) {
          // Find like button within this comment container (usually an SVG icon with heart role/label)
          const likeBtn = node.locator("button[aria-label='Like'], svg[aria-label='Like']").first();
          if (await likeBtn.isVisible()) {
            await likeBtn.click();
            console.log(`  ❤️ Liked comment from ${authorText.trim()}`);
            await page.waitForTimeout(1000);
          }
        }

        // Auto-Reply action
        if (autoReplyText) {
          const replyBtn = node.locator("button:has-text('Reply')").first();
          if (await replyBtn.isVisible()) {
            await replyBtn.click();
            await page.waitForTimeout(1000);
            
            // Wait for input textarea/box to focus
            const replyInput = page.locator("textarea[placeholder*='comment'], [role='textbox']").first();
            if (await replyInput.isVisible()) {
              await replyInput.focus();
              await page.keyboard.insertText(autoReplyText);
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
