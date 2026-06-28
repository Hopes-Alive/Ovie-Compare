import type { Context } from "hono";
import { getAdminSuppliers, patchAdminSupplier } from "../services/admin/get-suppliers.js";

export async function getAdminSuppliersHandler(c: Context) {
  try {
    const suppliers = await getAdminSuppliers();
    return c.json({ suppliers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load suppliers";
    return c.json({ error: message }, 500);
  }
}

export async function patchAdminSupplierHandler(c: Context) {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Missing supplier id" }, 400);
    const body = await c.req.json<{
      refresh_interval_minutes?: number;
      scrape_enabled?: boolean;
      live_check_enabled?: boolean;
    }>();
    const supplier = await patchAdminSupplier(id, body);
    return c.json({ supplier });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update supplier";
    return c.json({ error: message }, 400);
  }
}
