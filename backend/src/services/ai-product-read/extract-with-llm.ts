import { chatClient, CHAT_MODEL } from "../brain/llm-client.js";
import type { EnrichedPageSnapshot } from "./enrich-snapshot.js";
import type { AiExtractionResult, AiReadContext } from "./types.js";

const SYSTEM_PROMPT = `You extract structured product data from Australian dental supplier product pages.
Compare live page data against currentDatabase and return ALL product fields you can verify on the page.
Rules:
- Only extract values visible in the snapshot (pageText, windowProducts, domProductData, description, breadcrumbs).
- Never invent or guess prices. If price is not visible, set price to null and confidence to "low".
- Prices are AUD including GST unless clearly marked ex GST (then still report inc GST if both shown).
- Prefer window.products PriceForOneInc when present.
- stockStatus: in_stock, out_of_stock, low_stock, or unknown.
- stockQuantity: integer when AvailableQty or explicit stock count is on the page; otherwise null.
- If stock is not clearly stated, keep currentDatabase.stock_status — do not set unknown when the page simply omits stock.
- Set loginRequired true when page says login/call us to see price.
- category/subcategory: from breadcrumbs or CategoryHierarchy when visible.
- description: product description text only, not marketing boilerplate.
- confidence "high" only when price and name are clearly supported by the snapshot.`;

function parseOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseExtraction(raw: string): AiExtractionResult {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const stock = parsed.stockStatus;
  const validStock =
    stock === "in_stock" ||
    stock === "out_of_stock" ||
    stock === "low_stock" ||
    stock === "unknown"
      ? stock
      : "unknown";

  const confidence = parsed.confidence === "high" ? "high" : "low";

  let price: number | null = null;
  if (parsed.price != null && parsed.price !== "") {
    const n = Number(parsed.price);
    price = Number.isFinite(n) ? n : null;
  }

  let stockQuantity: number | null = null;
  if (parsed.stockQuantity != null && parsed.stockQuantity !== "") {
    const n = Number(parsed.stockQuantity);
    stockQuantity = Number.isFinite(n) ? Math.trunc(n) : null;
  }

  const parseOptionalDays = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  return {
    externalSku: parseOptionalString(parsed.externalSku),
    price,
    stockStatus: validStock,
    stockQuantity,
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "",
    brand: parseOptionalString(parsed.brand),
    category: parseOptionalString(parsed.category),
    subcategory: parseOptionalString(parsed.subcategory),
    description: parseOptionalString(parsed.description),
    imageSrc: parseOptionalString(parsed.imageSrc),
    packSize: parseOptionalString(parsed.packSize),
    unitOfMeasure: parseOptionalString(parsed.unitOfMeasure),
    deliveryText: parseOptionalString(parsed.deliveryText),
    deliveryMinDays: parseOptionalDays(parsed.deliveryMinDays),
    deliveryMaxDays: parseOptionalDays(parsed.deliveryMaxDays),
    loginRequired: Boolean(parsed.loginRequired),
    confidence,
    notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
  };
}

export async function extractWithLlm(
  snapshot: EnrichedPageSnapshot,
  context: AiReadContext,
): Promise<AiExtractionResult> {
  const userContent = JSON.stringify(
    {
      task: "Extract all current product fields from this supplier page snapshot. Compare with currentDatabase.",
      supplier: context.supplierName,
      productUrl: context.url,
      currentDatabase: context.currentDatabase,
      pageSnapshot: {
        pageTitle: snapshot.pageTitle,
        h1: snapshot.h1,
        breadcrumbs: snapshot.breadcrumbs,
        description: snapshot.description,
        brandField: snapshot.brandField,
        deliveryText: snapshot.deliveryText,
        imageUrls: snapshot.imageUrls,
        pageText: snapshot.parsedProduct
          ? snapshot.pageText.slice(0, 2500)
          : snapshot.pageText,
        windowProducts: snapshot.windowProducts,
        domProductData: snapshot.domProductData,
        loginHintDetected: snapshot.loginHint,
        adapterParsed: snapshot.parsedProduct,
      },
      requiredJsonShape: {
        externalSku: "string | null",
        name: "string",
        brand: "string | null",
        category: "string | null",
        subcategory: "string | null",
        description: "string | null",
        imageSrc: "string | null",
        packSize: "string | null",
        unitOfMeasure: "string | null",
        price: "number | null (AUD inc GST)",
        stockStatus: "in_stock | out_of_stock | low_stock | unknown",
        stockQuantity: "integer | null",
        deliveryText: "string | null",
        deliveryMinDays: "integer | null",
        deliveryMaxDays: "integer | null",
        loginRequired: "boolean",
        confidence: "high | low",
        notes: "string optional — list fields that changed vs currentDatabase",
      },
    },
    null,
    2,
  );

  const response = await chatClient.chat.completions.create({
    model: CHAT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI extraction returned empty response");
  }

  return parseExtraction(content);
}
