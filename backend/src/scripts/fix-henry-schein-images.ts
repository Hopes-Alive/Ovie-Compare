import "dotenv/config";
import { henryScheinImageUrlsForCode } from "../lib/product-images.js";
import { supabase } from "../lib/supabase.js";

/** Rewrite legacy Henry Schein /Original/ image_src values in the database. */
async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("slug", "henry-schein")
    .maybeSingle();

  if (!supplier?.id) {
    console.error("Henry Schein supplier not found");
    process.exit(1);
  }

  const { data: products, error } = await supabase
    .from("supplier_products")
    .select("id, external_sku, image_src")
    .eq("supplier_id", supplier.id)
    .ilike("image_src", "%ProductImages/Original/%");

  if (error) throw error;

  console.log(`Found ${products?.length ?? 0} products with legacy image paths`);

  let updated = 0;
  for (const product of products ?? []) {
    const sku = (product.external_sku as string | null) ?? "";
    const next = henryScheinImageUrlsForCode(sku)[0];
    if (!next || next === product.image_src) continue;

    if (dryRun) {
      console.log(`${product.id} ${sku}`);
      console.log(`  old: ${product.image_src}`);
      console.log(`  new: ${next}`);
    } else {
      const { error: ue } = await supabase
        .from("supplier_products")
        .update({ image_src: next })
        .eq("id", product.id as string);
      if (ue) console.error(ue.message);
      else updated++;
    }
  }

  console.log(dryRun ? "Dry run complete" : `Updated ${updated} products`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
