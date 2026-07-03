import fs from "fs";
import { db } from "../../db/db.js";
import { adsAnalytics } from "../../db/schema.js";

// Parses the downloaded CSV ads reports dynamically and inserts normalized rows into our database
export async function parseAndSaveAdsCSV(
  filePath: string,
  companyId: string,
  platform: "meta" | "tiktok" | "google" | "linkedin"
): Promise<void> {
  console.log(`📂 Parsing CSV ads report at: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const lines = fileContent.split(/\r?\n/);
  
  if (lines.length <= 1) {
    console.warn("⚠️ CSV report is empty or lacks rows. Skipping parsing.");
    return;
  }

  // 1. Parse and clean headers
  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  console.log("📝 CSV Headers detected:", headers);

  // Dynamic header matching
  const campaignIdx = headers.findIndex(h => 
    h.toLowerCase().includes("campaign name") || h.toLowerCase() === "campaign"
  );
  const spendIdx = headers.findIndex(h => 
    h.toLowerCase().includes("amount spent") || h.toLowerCase() === "spend" || h.toLowerCase() === "cost"
  );
  const impressionsIdx = headers.findIndex(h => 
    h.toLowerCase().includes("impressions")
  );
  const clicksIdx = headers.findIndex(h => 
    h.toLowerCase().includes("link clicks") || h.toLowerCase() === "clicks"
  );
  const conversionsIdx = headers.findIndex(h => 
    h.toLowerCase().includes("results") || h.toLowerCase() === "conversions" || h.toLowerCase() === "leads"
  );

  // Validate that we found at least the Campaign and Spend columns
  if (campaignIdx === -1 || spendIdx === -1) {
    throw new Error("CSV schema mismatch: Could not find required 'Campaign' or 'Spend/Amount Spent' columns.");
  }

  let rowsInserted = 0;

  // 2. Loop through rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split line by commas, ignoring commas wrapped inside quotes (e.g. campaign names like "Summer Sale, Phase 1")
    const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/"/g, "").trim());

    if (columns.length <= Math.max(campaignIdx, spendIdx)) {
      continue; // Skip malformed rows
    }

    const campaignName = columns[campaignIdx] || "Unnamed Campaign";
    const spendVal = parseFloat(columns[spendIdx].replace(/[^0-9.]/g, "")) || 0; // Strip currency symbols
    const impressionsVal = parseInt(columns[impressionsIdx]?.replace(/[^0-9]/g, ""), 10) || 0;
    const clicksVal = parseInt(columns[clicksIdx]?.replace(/[^0-9]/g, ""), 10) || 0;
    const conversionsVal = parseInt(columns[conversionsIdx]?.replace(/[^0-9]/g, ""), 10) || 0;

    console.log(`📊 Saving Campaign: ${campaignName} | Spend: $${spendVal} | Impressions: ${impressionsVal} | Clicks: ${clicksVal}`);

    // 3. Write row record to database
    await db.insert(adsAnalytics).values({
      companyId,
      platform,
      campaignName,
      date: new Date(), // Metric date context
      spend: spendVal,
      impressions: impressionsVal,
      clicks: clicksVal,
      conversions: conversionsVal
    });
    
    rowsInserted++;
  }

  console.log(`✅ Saved ${rowsInserted} campaigns metrics to SQLite.`);
}
