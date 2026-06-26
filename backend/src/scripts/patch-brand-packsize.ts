/**
 * Patches existing supplier_products rows by re-extracting brand and pack_size
 * directly from the stored raw_snapshot — no re-scraping needed.
 *
 * Run after fixing extractBrand / extractPackSize in the parsers.
 * Usage: npx tsx src/scripts/patch-brand-packsize.ts
 */
import "dotenv/config";
import { supabase } from "../lib/supabase.js";

// ── Inline extraction helpers (mirrors parser logic) ─────────────────────────

function cleanText(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return s.length > 0 ? s : undefined;
}

function cleanBrand(raw: string | undefined | null): string | undefined {
  const t = cleanText(raw);
  if (!t || t.toLowerCase() === "n/a" || t === "-") return undefined;
  if (t === t.toUpperCase() && t.length > 2) {
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
  return t;
}

const KNOWN_BRANDS = [
  "3M", "3M Solventum", "Acteon", "ADM", "Anaxdent", "Ansell", "Anthogyr", "Asiga",
  "Bausch", "Brasseler",
  "Candulor", "Coltene", "Colgate", "Curasept", "Cybertech",
  "DenTek", "Dentsply", "Dentsply Sirona", "Desktop Health", "DMG", "Durr",
  "EMS", "Essentials",
  "Flow Dental", "Formlabs",
  "GC", "GSK", "GlaxoSmithKline",
  "Haleon", "Hanson UK", "Henry Schein", "Heraeus", "Hu-Friedy", "Hu Friedy",
  "Indusbello", "Intensiv", "Ivoclar",
  "Kerr", "Keystone", "Komet", "Kuraray",
  "Mectron", "Medilab", "Meisinger", "Microflex",
  "Nextdent", "NextDent", "Noritake", "NSK",
  "Oral-B", "Ormco",
  "Polar",
  "SDI", "Saniflex", "Septodont", "Shofu", "SprintRay", "Straumann",
  "TePe", "Tokuyama",
  "Ultradent",
  "VOCO", "Vita",
  "W&H", "Wellmed",
  "Xylimelts",
];

function extractBrand(brandText: string | undefined, name: string): string | undefined {
  const cleaned = cleanBrand(brandText);
  if (cleaned) return cleaned;
  for (const brand of KNOWN_BRANDS) {
    if (name.toLowerCase().startsWith(brand.toLowerCase())) return brand;
  }
  return undefined;
}

const CARTON_X_PATTERN = /\bCarton\s+(\d+)\s*x\s*(\d+)\b|\b(\d+)\s*x\s*(\d+)\b/i;
const DASH_PACK_PATTERN = /\b(\d+)[-\s]Pack\b|\bPack\s+of\s+(\d+)\b/i;
const BOX_OF_PATTERN = /\b(?:box|carton)\s+of\s+(\d+)\b/i;
const SLASH_UNIT_PATTERN = /\b(\d+)\s*\/\s*(?:pk|box|bx|carton|ctn|pack)\b/i;
const SHORT_PK_PATTERN = /\b(\d+)\s*(?:pk|pcs?|pieces?)\b/i;

function extractPackSize(name: string): string | undefined {
  const carton = name.match(CARTON_X_PATTERN);
  if (carton) return `${carton[1] ?? carton[3]} x ${carton[2] ?? carton[4]}`;
  const dashPack = name.match(DASH_PACK_PATTERN);
  if (dashPack) return dashPack[1] ?? dashPack[2];
  const boxOf = name.match(BOX_OF_PATTERN);
  if (boxOf) return boxOf[1];
  const slashUnit = name.match(SLASH_UNIT_PATTERN);
  if (slashUnit) return slashUnit[1];
  const shortPk = name.match(SHORT_PK_PATTERN);
  if (shortPk) return shortPk[1];
  return undefined;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 500;

async function main() {
  console.log("Ovie — Brand + Pack Size Patch");
  console.log("=".repeat(60));

  let offset = 0;
  let totalPatched = 0;
  let totalSkipped = 0;
  let page = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from("supplier_products")
      .select("id, name, brand, pack_size, raw_snapshot")
      .range(offset, offset + PAGE_SIZE - 1)
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!rows || rows.length === 0) break;

    page++;
    console.log(`\nPage ${page}: ${rows.length} rows (offset ${offset})`);

    const updates: { id: string; brand?: string; pack_size?: string }[] = [];

    for (const row of rows) {
      const snap = row.raw_snapshot as Record<string, unknown> | null;
      const name = row.name as string;

      const newBrand = extractBrand(snap?.BrandText as string | undefined, name);
      const newPackSize = extractPackSize(name);

      const brandChanged = newBrand !== undefined && newBrand !== row.brand;
      const packChanged = newPackSize !== undefined && newPackSize !== row.pack_size;

      if (brandChanged || packChanged) {
        const patch: { id: string; brand?: string; pack_size?: string } = { id: row.id as string };
        if (brandChanged) patch.brand = newBrand;
        if (packChanged) patch.pack_size = newPackSize;
        updates.push(patch);
      } else {
        totalSkipped++;
      }
    }

    console.log(`  ${updates.length} to patch, ${rows.length - updates.length} unchanged`);

    // Batch the updates
    for (const update of updates) {
      const { id, ...patch } = update;
      const { error: ue } = await supabase
        .from("supplier_products")
        .update(patch)
        .eq("id", id);
      if (ue) {
        console.error(`  Update failed for ${id}:`, ue.message);
      } else {
        totalPatched++;
      }
    }

    offset += PAGE_SIZE;
    if (rows.length < PAGE_SIZE) break;
  }

  console.log("\n" + "=".repeat(60));
  console.log(`DONE  patched=${totalPatched}  unchanged=${totalSkipped}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
