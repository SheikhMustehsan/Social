import { launchBrowserWithProfile } from "../utils/browserLauncher.js";
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
  if (profileUrl && !profileUrl.includes("null")) {
    const isGrid = !profileUrl.includes('/video/') && 
                   !profileUrl.includes('/posts/') &&
                   !profileUrl.includes('/p/') &&
                   !profileUrl.includes('/feed/update/');
    urlsToCrawl.push({ url: profileUrl, isGrid });
  }

  if (urlsToCrawl.length === 0) {
    console.log(`⚠️ No URLs to crawl for profile ${socialProfileId}. Skipping.`);
    return [];
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

      // ── PLATFORM-SPECIFIC: Handle TikTok CAPTCHA puzzle ──────────────────
      if (platform === "tiktok") {
        try {
          const captcha = page.locator('div[id*="captcha"], div[class*="captcha"], div[class*="secsdk"], canvas');
          if (await captcha.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log("⚠️ TikTok CAPTCHA detected. Waiting 15s for manual solve or auto-timeout...");
            await page.waitForTimeout(15000);
          }
        } catch (_) {}
      }

      // ── Close common login/cookie/notification popups ─────────────────────
      try {
        const popupSelectors = [
          'button[aria-label="Dismiss"]',
          'button[aria-label="Close"]',
          'div[role="dialog"] button[aria-label="Close"]',
          'button[data-testid="close-button"]',
          'div[aria-label="Close"] svg',
          // Instagram login nudge
          'div[role="dialog"] button:has-text("Not Now")',
          'div[role="dialog"] button:has-text("Cancel")',
          // TikTok login popup
          'div[data-e2e="modal-close-inner-button"]',
          'button[class*="close"], div[class*="close-btn"]'
        ];
        for (const sel of popupSelectors) {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await btn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(800);
            console.log(`🧹 Closed popup: ${sel}`);
            break;
          }
        }
      } catch (_) {}

      // ── Detect Redirects (e.g. invalid post URL fell back to profile grid) ──
      const currentUrl = page.url();
      let isActuallyGrid = target.isGrid;
      if (!target.isGrid) {
        const isInstagramRedirect = platform === "instagram" && !currentUrl.includes("/p/") && !currentUrl.includes("/reel/");
        const isTikTokRedirect = platform === "tiktok" && !currentUrl.includes("/video/");
        const isLinkedInRedirect = platform === "linkedin" && !currentUrl.includes("/feed/update/") && !currentUrl.includes("/posts/");

        if (isInstagramRedirect || isTikTokRedirect || isLinkedInRedirect) {
          console.log(`⚠️ Redirected from post URL to grid page: ${currentUrl}. Falling back to grid post click.`);
          isActuallyGrid = true;
        }
      }

      // ── If we are on the main profile grid, click the most recent post ────
      if (isActuallyGrid) {
        let postSelector = "";
        if (platform === "instagram") postSelector = "a[href^='/p/'], a[href*='/reel/']";
        else if (platform === "facebook") postSelector = "div[role='article'] a[href*='/posts/'], a[href*='/posts/'], a[href*='/videos/']";
        else if (platform === "tiktok") postSelector = "div[data-e2e='user-post-item'] a, a[href*='/video/']";
        else if (platform === "linkedin") postSelector = "div.feed-shared-update-v2, main div[data-urn], div.occludable-update";

        if (postSelector) {
          const firstPost = page.locator(postSelector).first();
          if (await firstPost.isVisible({ timeout: 5000 }).catch(() => false)) {
            await firstPost.click();
            console.log(`🖱️ Clicked most recent grid post.`);
            await page.waitForTimeout(5000);
          } else {
            console.log(`⚠️ No posts found on grid for ${platform}. Skipping. Dumping debug screen.`);
            await page.screenshot({ path: `debug_grid_fail_${platform}.png` });
            continue;
          }
        }
      }

      // ── PLATFORM-SPECIFIC: Expand comments section ────────────────────────

      // LinkedIn: click "Comment" button on the post to expand comment list
      if (platform === "linkedin") {
        try {
          const commentBtn = page.locator('button.comment-button, button[aria-label*="comment"], button:has-text("Comment")').first();
          if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await commentBtn.click();
            console.log("💬 LinkedIn: Clicked Comment button to expand comments.");
            await page.waitForTimeout(3000);
          }
        } catch (_) {}
        // Also try clicking "Load more comments"
        try {
          const loadMore = page.locator('button.comments-comments-list__load-more-comments-button, button:has-text("Load more comments")').first();
          if (await loadMore.isVisible({ timeout: 2000 }).catch(() => false)) {
            await loadMore.click();
            await page.waitForTimeout(2000);
          }
        } catch (_) {}
      }

      // Instagram: click the comment icon/button on a post page if comments aren't visible
      if (platform === "instagram") {
        try {
          const commentIcon = page.locator('svg[aria-label="Comment"], a[href*="/comments/"]').first();
          if (await commentIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
            await commentIcon.click();
            await page.waitForTimeout(2000);
          }
        } catch (_) {}
      }

      // TikTok: click the comments tab
      if (platform === "tiktok") {
        try {
          const commentsTab = page.locator('[data-e2e="comment-icon"], button:has-text("Comments"), div[class*="CommentTab"]').first();
          if (await commentsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await commentsTab.click();
            console.log("💬 TikTok: Clicked Comments tab.");
            await page.waitForTimeout(3000);
          }
        } catch (_) {}
      }

      // ── Scroll to load comments ───────────────────────────────────────────
      console.log(`🔄 Scrolling to load comments for 6 seconds...`);
      const startTime = Date.now();
      while (Date.now() - startTime < 6000) {
        await page.evaluate(() => {
          window.scrollBy(0, 800);
          // Also scroll any overflow containers (comment panels)
          document.querySelectorAll<HTMLElement>('div[class*="comment"], div[class*="Comment"], section').forEach(el => {
            const style = window.getComputedStyle(el);
            if ((style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
              el.scrollBy(0, 800);
            }
          });
        });
        await page.waitForTimeout(1000);
      }

      // ── Extract comments via DOM ──────────────────────────────────────────
      console.log(`🤖 Extracting comments via DOM for ${platform}...`);
      
      let extractedComments: { author: string, text: string }[] = [];
      try {
        extractedComments = await page.evaluate((plat) => {
          const comments: { author: string, text: string }[] = [];

          if (plat === "tiktok") {
            // TikTok comment containers
            const nodes = document.querySelectorAll(
              'div[data-e2e="comment-level-1"], ' +
              'div[class*="CommentItem"], ' +
              'div[class*="comment-item"]'
            );
            nodes.forEach((node: Element) => {
              const author =
                (node.querySelector('span[data-e2e="comment-username-1"], a[data-e2e="comment-username-1"], span[class*="UserName"], a[class*="UserName"]') as HTMLElement)?.textContent?.trim() ||
                "Unknown";
              const text =
                (node.querySelector('p[data-e2e="comment-level-1-text"], span[data-e2e="comment-level-1-text"], p[class*="CommentText"], span[class*="CommentText"]') as HTMLElement)?.textContent?.trim() ||
                "";
              if (text && author !== "Unknown") comments.push({ author, text });
            });

          } else if (plat === "instagram") {
            // Instagram: comments are in li._a9zr elements inside ul
            const nodes = document.querySelectorAll('li._a9zr, ul[class*="_a9ym"] li, div[role="listitem"]');
            nodes.forEach((node: Element) => {
              // Author is a link with a span containing the username
              const authorEl = node.querySelector('h3 a, h2 a, a._a6hd span, span._aap6 a span, a[href*="/"] span') as HTMLElement;
              const author = authorEl?.textContent?.trim() || "";
              // Text: span with dir=auto that's not the author
              const allSpans = Array.from(node.querySelectorAll('span[dir="auto"], div[dir="auto"]')) as HTMLElement[];
              const textEl = allSpans.find(s => {
                const t = s.textContent?.trim() || "";
                return t.length > 0 && t !== author && !s.querySelector('a');
              });
              const text = textEl?.textContent?.trim() || "";
              if (text && author) comments.push({ author, text });
            });

          } else if (plat === "linkedin") {
            // LinkedIn: real comment container class is comments-comment-entity
            const nodes = document.querySelectorAll(
              'article.comments-comment-entity, ' +
              'article.comments-comment-item, ' +
              'li.comments-comment-item'
            );
            nodes.forEach((node: Element) => {
              // Author: in .comments-comment-meta__description-title span
              const authorEl = node.querySelector(
                '.comments-comment-meta__description-title span:not(.visually-hidden), ' +
                'h3.comments-comment-meta__description span:first-child, ' +
                '.comments-post-meta__name-text span[aria-hidden="true"]'
              ) as HTMLElement;
              const author = authorEl?.textContent?.trim() || "Unknown";

              // Text: the actual comment content (not metadata)
              const textEl = node.querySelector(
                '.comments-comment-item__main-content, ' +
                'span[dir="ltr"], ' +
                'p[dir="ltr"], ' +
                '.update-components-text span'
              ) as HTMLElement;
              const text = textEl?.textContent?.trim() || "";

              if (text && author !== "Unknown") comments.push({ author, text });
            });

          } else if (plat === "facebook") {
            // Facebook comment divs
            const nodes = document.querySelectorAll('div[aria-label*="Comment by"], div[data-testid="UFI2Comment/body"]');
            nodes.forEach((node: Element) => {
              const authorEl = node.querySelector('a[role="link"], h4 a, h3 a') as HTMLElement;
              const author = authorEl?.textContent?.trim() || "Unknown";
              const textEl = node.querySelector('div[dir="auto"] span, div[data-testid="UFI2Comment/message"] span') as HTMLElement;
              const text = textEl?.textContent?.trim() || "";
              if (text && author !== "Unknown") comments.push({ author, text });
            });
          }

          return comments;
        }, platform);

        if (extractedComments.length === 0) {
          console.log(`⚠️ No comments found, dumping debug files...`);
          await page.screenshot({ path: `debug_${platform}.png` });
          const html = await page.content();
          fs.writeFileSync(`debug_${platform}.html`, html);
        }

        // Deduplicate
        const uniqueComments = new Map<string, { author: string, text: string }>();
        for (const c of extractedComments) {
          uniqueComments.set(c.author + "_" + c.text, c);
        }
        extractedComments = Array.from(uniqueComments.values());
        
        console.log(`✅ DOM Extracted ${extractedComments.length} comments.`);
        if (extractedComments.length > 0) {
          console.log("Raw JSON:", JSON.stringify(extractedComments.slice(0, 5)));
        }
      } catch (err) {
        console.error("❌ Failed to extract comments via DOM:", err);
      }

      // ── For each comment, match rules and reply ───────────────────────────
      for (const comment of extractedComments) {
        const authorText = comment.author;
        const commentText = comment.text;

        if (!authorText || !commentText) continue;

        const commentId = `${authorText.trim()}_${commentText.trim().substring(0, 20)}`;
        allParsedComments.push({ id: commentId, author: authorText.trim(), text: commentText.trim() });
        
        console.log(`  [Comment] ${authorText.trim()}: ${commentText.trim()}`);
        
        // Determine which rule to apply
        let replyToUse: string | null = null;
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
        // Fallback wildcard rule
        if (!replyToUse) {
          const fallbackRule = commentRules.find((r: any) => r.triggerKeyword === "*");
          if (fallbackRule) replyToUse = fallbackRule.replyText;
        }

        if (!replyToUse) {
          console.log(`  ⏭️ No rule matched for comment by ${authorText.trim()}. Skipping reply.`);
          continue;
        }

        // ── Click Reply button for this comment ────────────────────────────
        console.log(`  🔍 Locating reply button for comment by ${authorText}...`);
        let replied = false;
        try {
          // Strategy 1: find comment wrapper containing author text, then find Reply button inside
          const commentWrappers = page.locator(
            'article.comments-comment-item, article[data-id], li.comments-comment-item, ' +
            'div[data-e2e="comment-level-1"], div[class*="CommentItem"], ' +
            'li._a9zr, div[role="listitem"], li[role="menuitem"]'
          );
          const count = await commentWrappers.count();
          for (let i = 0; i < Math.min(count, 30); i++) {
            const wrapper = commentWrappers.nth(i);
            const wrapperText = await wrapper.textContent().catch(() => "");
            if (wrapperText && wrapperText.includes(authorText.trim())) {
              // Found the comment wrapper — look for Reply button inside
              const replyBtn = wrapper.locator(
                'button:has-text("Reply"), span:has-text("Reply"), a:has-text("Reply"), ' +
                'div[data-e2e="comment-reply-1"], button[data-e2e="comment-reply"]'
              ).first();
              if (await replyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await replyBtn.scrollIntoViewIfNeeded();
                await replyBtn.click();
                replied = true;
                console.log(`  ✅ Clicked Reply inside comment wrapper.`);
                break;
              }
              // If no reply button visible, hover to make it appear
              await wrapper.hover().catch(() => {});
              await page.waitForTimeout(500);
              if (await replyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await replyBtn.click();
                replied = true;
                console.log(`  ✅ Clicked Reply after hover.`);
                break;
              }
            }
          }
        } catch (e) {
          console.log(`  ⚠️ Error clicking reply: ${e}`);
        }

        if (!replied) {
          console.log(`  ⚠️ Could not click reply button for ${authorText.trim()}.`);
          continue;
        }

        // ── Wait for reply input box and type ─────────────────────────────
        await page.waitForTimeout(1500);
        try {
          // Find the newly focused/active reply input
          const inputSelectors = [
            'div[contenteditable="true"].ql-editor',
            'div[contenteditable="true"][data-placeholder*="reply" i]',
            'div[contenteditable="true"][data-placeholder*="Reply" i]',
            'div[contenteditable="true"]',
            'textarea[placeholder*="reply" i]',
            'textarea',
          ];
          let inputBox = null;
          for (const sel of inputSelectors) {
            const el = page.locator(sel).last();
            if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
              inputBox = el;
              break;
            }
          }

          if (inputBox) {
            await inputBox.click();
            await page.waitForTimeout(500);
            await page.keyboard.insertText(replyToUse);
            await page.waitForTimeout(1000);
            console.log(`  📝 Typed reply into input box.`);

            // Screenshot before posting (for debugging)
            await page.screenshot({ path: `debug_reply_${authorText.replace(/[^a-zA-Z0-9]/g, "")}.png` });

            // Click Post/Submit button or press Enter
            const postBtn = page.locator(
              'button.comments-comment-box__submit-button, ' +
              'button[data-control-name="comment.reply_create"], ' +
              'button.artdeco-button--primary:has-text("Post"), ' +
              'button:has-text("Post"), ' +
              'button[type="submit"]'
            ).last();
            if (await postBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await postBtn.click({ force: true });
              console.log(`  ✉️ Clicked Post button.`);
            } else {
              await page.keyboard.press("Enter");
              console.log(`  ✉️ Pressed Enter to post reply.`);
            }
            console.log(`  ✅ Reply posted to ${authorText.trim()}`);
            await page.waitForTimeout(2000);
          } else {
            console.log(`  ⚠️ Could not find reply input box after clicking Reply.`);
          }
        } catch (e) {
          console.log(`  ⚠️ Error typing/posting reply: ${e}`);
        }
      }

      // Close modal if opened from grid
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
