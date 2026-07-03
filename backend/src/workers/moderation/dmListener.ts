import { BrowserContext } from "playwright";
import { launchBrowserWithProfile } from "../utils/browserLauncher.js";
import { syncChromeProfile } from "../utils/profileSync.js";
import path from "path";
import fs from "fs";

export async function startDirectMessageListener(
  profilePath: string,
  platform: "instagram" | "facebook",
  autoReplyRules: { trigger: string; reply: string }[] = []
): Promise<void> {
  const tempProfilePath = path.resolve(`./data/profiles/running_dm_listener_${Date.now()}`);
  
  // Sync session profiles
  syncChromeProfile(profilePath, tempProfilePath);
  
  const context = await launchBrowserWithProfile(tempProfilePath, { headless: true });
  const page = await context.newPage();
  
  try {
    const inboxUrl = platform === "instagram" 
      ? "https://www.instagram.com/direct/inbox/"
      : "https://business.facebook.com/latest/inbox/all"; // Meta Business Suite unified inbox

    console.log(`➡️ Inbox Listener: Navigating to DMs at ${inboxUrl}...`);
    await page.goto(inboxUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);

    // Instagram selector constants
    const unreadConvoSelector = "div[style*='font-weight: 600'], div._ab8w._ab94._ab9f:has-text('Unread')"; // Matches unread threads
    
    // Run the checker on a loop (for demonstration, we run 3 checks and stop. In production, this runs as a persistent worker)
    for (let loop = 0; loop < 3; loop++) {
      console.log(`🔍 [DM Loop ${loop + 1}] Scanning for unread messages...`);
      
      const unreadThreads = page.locator(unreadConvoSelector);
      const count = await unreadThreads.count();

      if (count > 0) {
        console.log(`📬 Found ${count} unread conversation threads.`);
        
        // Process the first unread thread
        const firstThread = unreadThreads.first();
        await firstThread.click();
        await page.waitForTimeout(2000); // Wait for thread messages panel to load

        // Read the last message bubble text
        const messageBubbles = page.locator("div[role='row'] span, div[data-testid='message-text-container']"); // Generic msg classes
        const totalBubbles = await messageBubbles.count();

        if (totalBubbles > 0) {
          const lastBubble = messageBubbles.nth(totalBubbles - 1);
          const incomingText = await lastBubble.textContent().catch(() => "");
          console.log(`💬 Last message text: "${incomingText}"`);

          // Process Auto-Reply Rules
          let replyMessage = "Hello! Thanks for writing to us. A representative will get back to you shortly.";
          
          if (incomingText) {
            const matchedRule = autoReplyRules.find(rule => 
              incomingText.toLowerCase().includes(rule.trigger.toLowerCase())
            );
            if (matchedRule) {
              replyMessage = matchedRule.reply;
              console.log(`🎯 Match found for trigger "${matchedRule.trigger}"`);
            }
          }

          // Type and Send Reply
          console.log(`✉️ Sending reply: "${replyMessage}"`);
          const msgInput = page.locator("textarea[placeholder*='Message...'], [role='textbox']").first();
          if (await msgInput.isVisible()) {
            await msgInput.focus();
            await page.keyboard.write(replyMessage);
            await page.waitForTimeout(500);
            
            // Press Enter to send, or click "Send" button
            await page.keyboard.press("Enter");
            console.log("✅ Message sent successfully!");
            await page.waitForTimeout(2000);
          }
        }
      } else {
        console.log("📭 No unread DMs found.");
      }
      
      // Wait 10 seconds before next scan
      await page.waitForTimeout(10000);
    }

  } catch (error: any) {
    console.error("❌ Direct Message Listener loop failed:", error.message);
    throw error;
  } finally {
    await context.close();
    if (fs.existsSync(tempProfilePath)) {
      fs.rmSync(tempProfilePath, { recursive: true, force: true });
    }
  }
}
