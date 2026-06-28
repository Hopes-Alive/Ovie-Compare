import { chatClient, CHAT_MODEL } from "../brain/llm-client.js";
import type { PageSnapshot } from "./capture-page-snapshot.js";
import type { AiExtractionResult, AiReadContext } from "./types.js";

const SYSTEM_PROMPT = `You extract structured product data from Australian dental supplier product pages.
Rules:
- Only extract values visible in the provided page content or window.products JSON.
- Never invent or guess prices. If price is not visible, set price to null and confidence to "low".
- Prices are AUD including GST unless clearly marked ex GST (then still report inc GST if both shown).
- Prefer window.products PriceForOneInc when present.
- stockStatus: in_stock, out_of_stock, low_stock, or unknown.
- If stock is not clearly stated on the page, keep currentDatabase.stockStatus — do not set unknown when the page simply omits stock.
- Set loginRequired true when page says login/call us to see price.
- confidence "high" only when price and name are clearly supported by the snapshot.`;

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

  return {
    price,
    stockStatus: validStock,
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "",
    brand: typeof parsed.brand === "string" ? parsed.brand : null,
    packSize: typeof parsed.packSize === "string" ? parsed.packSize : null,
    loginRequired: Boolean(parsed.loginRequired),
    confidence,
    notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
  };
}

export async function extractWithLlm(
  snapshot: PageSnapshot,
  context: AiReadContext,
): Promise<AiExtractionResult> {
  const userContent = JSON.stringify(
    {
      task: "Extract current product fields from this supplier page snapshot.",
      supplier: context.supplierName,
      productUrl: context.url,
      currentDatabase: {
        name: context.dbName,
        price: context.dbPrice,
        sku: context.dbSku,
        brand: context.dbBrand,
        packSize: context.dbPackSize,
        stockStatus: context.dbStockStatus,
      },
      pageText: snapshot.pageText,
      windowProducts: snapshot.windowProducts,
      loginHintDetected: snapshot.loginHint,
      requiredJsonShape: {
        price: "number | null (AUD inc GST)",
        stockStatus: "in_stock | out_of_stock | low_stock | unknown",
        name: "string",
        brand: "string | null",
        packSize: "string | null",
        loginRequired: "boolean",
        confidence: "high | low",
        notes: "string optional",
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
