/**
 * Static description of every filterable column in supplier_products.
 * Injected into the LLM system prompt so it knows exactly what to filter on.
 * Update this if the schema changes.
 */
export const COLUMN_SCHEMA = `
## Database columns you can filter on (supplier_products table)

| Column | Type | What it stores | Example values |
|--------|------|----------------|----------------|
| name | text | Full product name. IMPORTANT: Use SHORT single keywords for partial matching — the filter uses ILIKE "%value%". Do NOT use full phrases with word-order assumptions. Good: name="BluWhite" or name="Arti-Spray". Bad: name="BluWhite diamond bur" (word-order mismatch), name="articulating spray" (phrase won't substring-match "Arti-Spray"). | "Medicom Nitrile Gloves Medium 100pk", "Komet Diamond Bur 835-014 FG" |
| brand | text | Manufacturer or brand name | "Medicom", "3M", "Komet", "GC", "Dentsply Sirona" |
| category | text | Broad product category — see alias table below for cross-supplier differences | "Disposables", "Burs", "Impression" |
| subcategory | text | More specific classification. Exact values in DB include: "Gloves", "Dental Burs", "Composite", "Cements", "Bonds & Etch", "Endodontic & Surgical", "Finishing & Polishing", "Impression", "Core Build-Up", "Adhesives & Cements", "Disinfectants & Detergents" | "Gloves", "Composite" |
| supplier_slug | enum | Which supplier stocks this product | "henry-schein", "adam-dental" |
| price | numeric | Price in AUD, typically includes GST | 5.95, 12.50, 168.15, 2209.35 |
| stock_status | enum | Current availability | "in_stock", "out_of_stock", "low_stock", "unknown" |
| pack_size | text | Quantity or size descriptor | "100 pack", "50 pack", "1 pack", "500 gm", "10 ml" |
| description | text | Full product description (may be empty) | "Powder-free nitrile examination gloves, textured fingertips" |

## Category aliases — same product type, different label per supplier

| Concept | Henry Schein value | Adam Dental value |
|---------|-------------------|-------------------|
| Burs / rotary instruments | "Burs" | "Dental Burs" |
| Hand instruments / scalers | "Instruments" | "Dental Instruments" |
| Prevention / hygiene | "Preventive" | "Preventative" |
| Anaesthetics / local anaesthetic | "Anaesthetic" | (no exact category — use name filter e.g. name="lignocaine" or name="articaine") |
| Shared exactly | "Disposables", "Crown & Bridge", "Oral Surgery", "Restorative & Cosmetic", "Finishing & Polishing", "Laboratory", "Articulating" | same |

**CRITICAL RULE for cross-supplier queries:** When the user asks about burs, instruments, or anaesthetics without specifying a supplier, DO NOT set the category filter (leave it unset) and use the name filter instead. The retrieval system will search both suppliers in parallel and apply supplier-specific category mapping automatically.

## Supplier names
- "henry-schein" → Henry Schein Australia
- "adam-dental" → Adam Dental

## Price notes
- All prices are AUD
- Prices typically include GST
- Use price_min / price_max for range queries ("under $20", "between $10 and $50")
- Use price_exact only when user specifies an exact price

## Sort options
- "price_asc" → cheapest first (use when user says "cheapest", "lowest price", "budget")
- "price_desc" → most expensive first (use when user says "premium", "highest quality by price")
- "relevance" → similarity-based sort (default — best for general queries)

## Important rules
- Only set a filter if the user's message clearly implies a value for that column
- IMPORTANT: Product-type descriptors like "nitrile", "latex", "vinyl", "composite", "amalgam" etc. belong in the "name" filter (partial match), NOT in subcategory
- IMPORTANT: For gloves, set category="Disposables" AND subcategory="Gloves" AND name="nitrile" (if nitrile was mentioned)
- IMPORTANT: For burs without a specified supplier, leave category unset and use name="bur" or name="diamond bur"
- IMPORTANT: For anaesthetics without a specified supplier, leave category unset and use name="lignocaine" or name="articaine" or name="anaesthetic"
- Do NOT guess subcategories — only set subcategory if you are confident it exactly matches a known value from the list above
- The rewritten_query must be a standalone search phrase that captures the user's full intent including context from conversation history
- If the user says "those" or "the same ones" or similar, resolve the reference from history into the rewritten_query
`.trim();
