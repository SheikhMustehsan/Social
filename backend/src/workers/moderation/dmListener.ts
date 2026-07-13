import { BrowserContext } from "playwright";
import { launchBrowserWithProfile } from "../utils/browserLauncher.js";
import path from "path";
import fs from "fs";
import { db } from "../../db/db.js";
import { moderationRules } from "../../db/schema.js";
import { eq, and, or, isNull } from "drizzle-orm";

export async function scanInboxOnce(
  profilePath: string,
  platform: string,
  socialProfileId: string
): Promise<number> {
  process.env.DISPLAY = ":99";

  let rules: any[] = [];
  try {
    rules = await db.select()
      .from(moderationRules)
      .where(
        and(
          or(
            eq(moderationRules.socialProfileId, socialProfileId),
            isNull(moderationRules.socialProfileId)
          ),
          eq(moderationRules.type, "dm")
        )
      );
  } catch (e) {
    console.warn("Failed to fetch moderation rules:", e);
  }

  const context = await launchBrowserWithProfile(profilePath, { headless: false });
  const page = await context.newPage();
  let repliesSent = 0;
  
  try {
    const inboxUrl = platform === "instagram" ? "https://www.instagram.com/direct/inbox/"
      : platform === "facebook" ? "https://business.facebook.com/latest/inbox/all"
      : platform === "tiktok" ? "https://www.tiktok.com/messages"
      : "https://www.linkedin.com/messaging/";

    console.log(`➡️ Inbox Listener: Navigating to DMs at ${inboxUrl}...`);
    await page.goto(inboxUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);

    let unreadConvoSelector = "";
    if (platform === "instagram") unreadConvoSelector = "div[style*='font-weight: 600'], div._ab8w._ab94._ab9f:has-text('Unread')";
    else if (platform === "facebook") unreadConvoSelector = "div[style*='font-weight: bold']"; // Approximated
    else if (platform === "tiktok") unreadConvoSelector = "li[data-e2e='message-item'] div[class*='Dot'], li[data-e2e='message-item']"; // Fallback to first if no dot
    else if (platform === "linkedin") unreadConvoSelector = "li.msg-conversation-listitem--unread, li.msg-conversation-listitem"; 
    
    console.log(`🔍 Scanning for unread messages using selector: ${unreadConvoSelector}`);
    const unreadThreads = page.locator(unreadConvoSelector);
    const count = await unreadThreads.count();

    if (count > 0) {
      console.log(`📬 Found ${count} conversation threads (processing 1 for testing).`);
      
      // Process only the first thread for testing
      const firstThread = unreadThreads.first();
      await firstThread.click();
      await page.waitForTimeout(3000); // Wait for thread messages panel to load

      // Read the last message bubble text
      let messageBubbles = null;
      if (platform === "linkedin") messageBubbles = page.locator("p.msg-s-event-listitem__body");
      else if (platform === "tiktok") messageBubbles = page.locator("div[data-e2e='message-text']");
      else messageBubbles = page.locator("div[role='row'] span, div[data-testid='message-text-container']"); // FB/IG

      const totalBubbles = await messageBubbles.count();

      if (totalBubbles > 0) {
        const lastBubble = messageBubbles.nth(totalBubbles - 1);
        const incomingText = await lastBubble.textContent().catch(() => "");
        console.log(`💬 Last message text: "${incomingText}"`);

        // Process Auto-Reply Rules
        let replyToUse = null;
        if (incomingText) {
          for (const rule of rules) {
            if (rule.triggerKeyword !== "*") {
              const keywords = rule.triggerKeyword.split(",").map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0);
              const lowerComment = incomingText.toLowerCase();
              if (keywords.some((k: string) => lowerComment.includes(k))) {
                replyToUse = rule.replyText;
                break;
              }
            }
          }
        }
        if (!replyToUse) {
          const fallbackRule = rules.find(r => r.triggerKeyword === "*");
          if (fallbackRule) replyToUse = fallbackRule.replyText;
        }

        if (replyToUse) {
          let msgInput = null;
          if (platform === "linkedin") msgInput = page.locator("div.msg-form__contenteditable[contenteditable='true']").first();
          else if (platform === "tiktok") msgInput = page.locator("div[data-e2e='message-input'] div[contenteditable='true']").first();
          else msgInput = page.locator("textarea[placeholder*='Message...'], [role='textbox']").first();

          if (msgInput && await msgInput.isVisible()) {
            await msgInput.focus();
            await page.keyboard.insertText(replyToUse);
            await page.waitForTimeout(500);

            // Press Enter to send
            await page.keyboard.press("Enter");
            console.log("✅ Message sent successfully!");
            repliesSent++;
            await page.waitForTimeout(2000);
          } else {
             console.log("⚠️ Could not find message input box.");
          }
        } else {
          console.log(`💬 No rule matched, skipping reply.`);
        }
      }
    } else {
      console.log("📭 No unread DMs found.");
    }
    
    return repliesSent;
  } catch (error: any) {
    console.error("❌ Direct Message Listener loop failed:", error.message);
    throw error;
  } finally {
    await context.close();
  }
}
