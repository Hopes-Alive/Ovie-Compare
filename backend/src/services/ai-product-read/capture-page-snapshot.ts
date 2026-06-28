import type { Page } from "playwright";

const PAGE_WAIT_MS = 4000;
const PAGE_TIMEOUT_MS = 60_000;
const MAX_TEXT_CHARS = 8000;

export type WindowProductEntry = {
  ProductCode?: string;
  Description?: string;
  PriceForOneInc?: string;
  PriceForOneEx?: string;
  AvailableQty?: string;
};

export type PageSnapshot = {
  url: string;
  pageText: string;
  windowProducts: WindowProductEntry[];
  loginHint: boolean;
};

export async function capturePageSnapshot(page: Page, url: string): Promise<PageSnapshot> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
  await page.waitForTimeout(PAGE_WAIT_MS);

  const captured = await page.evaluate((maxChars) => {
    const text = document.body?.innerText ?? "";
    const products =
      (window as unknown as { products?: WindowProductEntry[] }).products ?? [];
    const loginHint = /call us|login to see|sign in to see|sign in for price/i.test(text);
    return {
      pageText: text.slice(0, maxChars),
      windowProducts: products.slice(0, 20),
      loginHint,
    };
  }, MAX_TEXT_CHARS);

  return {
    url,
    pageText: captured.pageText,
    windowProducts: captured.windowProducts,
    loginHint: captured.loginHint,
  };
}
