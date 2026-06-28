import { chromium } from "playwright";
import { AdamDentalAdapter } from "../scrapers/adam-dental/adapter.js";

const url =
  "https://www.adamdental.com.au/crown-and-bridge/temporary-material/dmg-luxatemp-fluorescence-temporary-crown-and-bridge";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  locale: "en-AU",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
});

const adapter = new AdamDentalAdapter();
const parsed = await adapter.parseProductPage(page, url, { externalSku: "P-LUXATEMPFLAMT" });

console.log(JSON.stringify(parsed, null, 2));
await browser.close();
