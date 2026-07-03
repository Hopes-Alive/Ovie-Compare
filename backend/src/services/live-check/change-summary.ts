import type { ProductAction } from "../scrape/upsert-products.js";

export type FieldChange = {
  label: string;
  from: string;
  to: string;
};

export function mapActionChanges(action: ProductAction | undefined): FieldChange[] {
  return (
    action?.changes?.map((c) => ({
      label: c.label,
      from: c.from,
      to: c.to,
    })) ?? []
  );
}

/** True only when the DB row had field updates — not just last_checked_at touch. */
export function hasFieldChanges(changes: FieldChange[]): boolean {
  return changes.length > 0;
}
