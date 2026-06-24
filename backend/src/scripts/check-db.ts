import "dotenv/config";
import { supabase } from "../lib/supabase.js";

const { data, error } = await supabase
  .from("suppliers")
  .select("id, name, adapter_key")
  .limit(5);

if (error) {
  console.log("DB check failed:", error.message, "(code:", error.code + ")");
  if (error.code === "42P01") {
    console.log("\n→ Tables do not exist. Run the SQL migration first.");
    console.log("  Open: https://supabase.com/dashboard/project/shbckwztiwdnvkppwqpm/sql/new");
  }
} else {
  console.log("DB connected. Suppliers found:", JSON.stringify(data, null, 2));
}
