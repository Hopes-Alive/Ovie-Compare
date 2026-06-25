/**
 * Discovers all product-listing category URLs from Adam Dental Australia.
 *
 * Strategy:
 *  1. Load the homepage — nav links are in the DOM without hover/JS.
 *  2. Extract every internal <a> href that looks like a category path.
 *  3. Filter out known non-category paths.
 *  4. Keep only "leaf" categories (those with no deeper sub-paths in the set).
 */

import type { Browser } from "playwright";
import { ADAM_DENTAL_BASE, EXCLUDED_SEGMENTS } from "./selectors.js";

export type CategoryInfo = {
  name: string;
  path: string;
};

const EXCLUDED_FULL_PATHS = new Set(["/", "/home", "/specials", "/equipment"]);

function isValidCategoryPath(href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  if (href === "/") return false;

  const clean = href.split("?")[0].split("#")[0];
  const segments = clean.split("/").filter(Boolean);

  // Category paths have 1–4 segments
  if (segments.length === 0 || segments.length > 4) return false;

  if (segments.some((s) => EXCLUDED_SEGMENTS.has(s.toLowerCase()))) return false;
  if (EXCLUDED_FULL_PATHS.has(clean)) return false;

  // Reject paths with file extensions or spaces
  if (clean.includes(" ") || /\.\w{2,4}$/.test(clean)) return false;

  // Reject very long last segments (product pages, not categories)
  const lastSegment = segments[segments.length - 1];
  if (lastSegment.length > 60) return false;

  return true;
}

function labelFromPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments
    .map((s) =>
      s
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .join(" > ");
}

export async function crawlCategories(browser: Browser): Promise<CategoryInfo[]> {
  const page = await browser.newPage();

  try {
    console.log("Loading Adam Dental homepage…");
    await page.goto(`${ADAM_DENTAL_BASE}/`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(4000);

    const allHrefs: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map(
        (a) => (a as HTMLAnchorElement).getAttribute("href") ?? "",
      ),
    );

    const seen = new Set<string>();
    const candidates: CategoryInfo[] = [];

    for (const raw of allHrefs) {
      let href = raw.trim();
      if (href.startsWith(ADAM_DENTAL_BASE)) {
        href = href.slice(ADAM_DENTAL_BASE.length) || "/";
      }

      const cleanPath = href.split("?")[0].split("#")[0].toLowerCase();
      if (seen.has(cleanPath)) continue;
      if (!isValidCategoryPath(cleanPath)) continue;

      seen.add(cleanPath);
      candidates.push({
        name: labelFromPath(cleanPath),
        path: cleanPath,
      });
    }

    // Keep only leaf categories (those that have no deeper paths as prefixes)
    const pathSet = new Set(candidates.map((c) => c.path));
    const leafCategories = candidates.filter((cat) => {
      // A category is a leaf if no other category starts with cat.path + "/"
      return !candidates.some(
        (other) =>
          other.path !== cat.path &&
          other.path.startsWith(cat.path + "/"),
      );
    });

    leafCategories.sort((a, b) => a.path.localeCompare(b.path));
    console.log(
      `Found ${candidates.length} category paths, ${leafCategories.length} leaf categories.`,
    );
    return leafCategories;
  } finally {
    await page.close();
  }
}
