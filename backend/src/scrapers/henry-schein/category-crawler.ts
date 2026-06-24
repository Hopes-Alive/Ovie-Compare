/**
 * Discovers all product-listing category URLs from Henry Schein Australia.
 *
 * Strategy:
 *  1. Load the homepage once — no clicks/hover needed, nav links are in the DOM.
 *  2. Extract every internal <a> href that looks like a category path.
 *  3. Filter out known non-category paths (account, basket, etc.).
 *  4. Return deduplicated list sorted alphabetically.
 *
 * Intentionally avoids visiting each URL during discovery — the seed script
 * already handles empty categories gracefully (produces 0 products, skips upsert).
 */

import type { Browser } from "playwright";
import { HENRY_SCHEIN_BASE } from "./selectors.js";

export type CategoryInfo = {
  name: string;
  path: string;
};

// Any path segment matching one of these is excluded
const EXCLUDED_SEGMENTS = new Set([
  "account",
  "basket",
  "cart",
  "checkout",
  "contact",
  "about",
  "about-us",
  "search",
  "login",
  "register",
  "logout",
  "sitemap",
  "privacy",
  "privacy-policy",
  "terms",
  "returns",
  "help",
  "news",
  "blog",
  "faq",
  "faqs",
  "careers",
  "documents",
  "pdfs",
  "newsletter-subscription",
  "forgot-password",
  "patient-resources",
  "modern-slavery-statement",
  "hscares",
  "pds",
  "henry-schein-360",
  "practice-green",
  "dental-solutions",
  "endodontic-solutions",
  "orthodontic-solutions",
  "brands",       // brand filter pages duplicate category products
  "brand",
]);

// Exact top-level paths that are navigation/info pages, not product listings
const EXCLUDED_FULL_PATHS = new Set([
  "/",
  "/home",
  "/categories",
  "/ProductDisplay.aspx",
]);

function isValidCategoryPath(href: string): boolean {
  // Must be an internal path only (no host, no hash-only)
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  if (href === "/") return false;

  const clean = href.split("?")[0].split("#")[0];
  const segments = clean.split("/").filter(Boolean);

  // Category paths have 1–4 segments; product pages usually have 4+ long segments
  if (segments.length === 0 || segments.length > 4) return false;

  // Exclude any path whose segments include a known non-category keyword
  if (segments.some((s) => EXCLUDED_SEGMENTS.has(s.toLowerCase()))) return false;
  if (EXCLUDED_FULL_PATHS.has(clean)) return false;

  // Reject paths that contain spaces or file extensions (not real category URLs)
  if (clean.includes(" ") || /\.\w{2,4}$/.test(clean)) return false;

  // Exclude paths that look like a product page: last segment is very long (>50 chars)
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
    console.log("Loading Henry Schein homepage…");
    await page.goto(`${HENRY_SCHEIN_BASE}/`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(4000);

    // Pull every anchor href from the page — nav links are in the DOM without hover
    const allHrefs: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map(
        (a) => (a as HTMLAnchorElement).getAttribute("href") ?? "",
      ),
    );

    // Normalise, deduplicate, and filter
    const seen = new Set<string>();
    const categories: CategoryInfo[] = [];

    for (const raw of allHrefs) {
      // Strip the origin if it's an absolute URL pointing to the same host
      let href = raw.trim();
      if (href.startsWith(HENRY_SCHEIN_BASE)) {
        href = href.slice(HENRY_SCHEIN_BASE.length) || "/";
      }

      const cleanPath = href.split("?")[0].split("#")[0].toLowerCase();
      if (seen.has(cleanPath)) continue;
      if (!isValidCategoryPath(cleanPath)) continue;

      seen.add(cleanPath);
      categories.push({
        name: labelFromPath(cleanPath),
        path: cleanPath,
      });
    }

    categories.sort((a, b) => a.path.localeCompare(b.path));
    return categories;
  } finally {
    await page.close();
  }
}
