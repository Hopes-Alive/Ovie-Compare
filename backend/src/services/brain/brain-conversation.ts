/**
 * Brain conversation — manages both LLM turns using the Azure AI Foundry
 * OpenAI-compatible API.
 *
 * Turn 1: Send system prompt (column schema) + conversation history + user
 *         message with the searchProducts tool definition. Parse the tool call
 *         to get { rewritten_query, filters }.
 *
 * Turn 2: Send tool results (retrieved products) back to the LLM and stream
 *         the final answer token by token.
 */
import type OpenAI from "openai";
import { chatClient, CHAT_MODEL } from "./llm-client.js";
import { COLUMN_SCHEMA } from "./column-schema.js";
import type { ChatHistoryMessage, SearchFilters, ProductRow, ProductCardData, SseEvent } from "./types.js";
import { computeFreshness, formatLastCheckedAgo } from "./freshness.js";
import { getSupplierDisplayName } from "../../lib/supplier-display-name.js";
import { buildProductImageUrls } from "../../lib/product-images.js";

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

const SEARCH_PRODUCTS_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "searchProducts",
    description:
      "Search for dental supply products in the database. Call this whenever the user asks about products, prices, availability, or comparisons. Always set rewritten_query.",
    parameters: {
      type: "object",
      required: ["rewritten_query"],
      properties: {
        rewritten_query: {
          type: "string",
          description:
            "Standalone search phrase capturing the full user intent, resolving any references from conversation history (e.g. 'those medium ones' → 'nitrile gloves medium'). Used for semantic similarity search.",
        },
        name: {
          type: "string",
          description: "Partial match on product name. Only set if user names a specific product.",
        },
        brand: {
          type: "string",
          description: "Filter by brand/manufacturer name.",
        },
        category: {
          type: "string",
          description: "Filter by product category (e.g. 'Gloves', 'Burs', 'Impression').",
        },
        subcategory: {
          type: "string",
          description: "Filter by subcategory.",
        },
        supplier_slug: {
          type: "string",
          enum: ["henry-schein", "adam-dental"],
          description: "Restrict to a specific supplier.",
        },
        stock_status: {
          type: "string",
          enum: ["in_stock", "out_of_stock", "low_stock", "unknown"],
          description: "Filter by stock availability.",
        },
        price_exact: {
          type: "number",
          description: "Exact price match (AUD). Rarely used.",
        },
        price_min: {
          type: "number",
          description: "Minimum price (AUD). Use for 'over $X' queries.",
        },
        price_max: {
          type: "number",
          description: "Maximum price (AUD). Use for 'under $X', 'cheapest', 'budget' queries.",
        },
        sort_by: {
          type: "string",
          enum: ["price_asc", "price_desc", "relevance"],
          description:
            "'price_asc' for cheapest-first, 'price_desc' for most expensive, 'relevance' for semantic match (default).",
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const PLANNER_SYSTEM = `You are Ovie's dental supply search assistant. Ovie helps Australian dental clinics compare products and prices across suppliers.

Your job in this turn:
1. Understand the user's current message in context of the conversation history.
2. Call the searchProducts tool with the most relevant filters extracted from the message.
3. Always set rewritten_query — a clear, standalone search phrase capturing full intent.
4. Only set other filters when the user explicitly mentions them.

${COLUMN_SCHEMA}

IMPORTANT: You MUST call the searchProducts tool. Do not reply in text in this turn.`;

const ANSWER_SYSTEM = `You are Ovie's dental supply assistant helping Australian dental clinics compare products and prices across suppliers.

You will receive a JSON list of products retrieved from our database. Your job:
1. Write a clear, helpful response based ONLY on the provided products.
2. Always mention prices with "AUD" and note if data was checked more than a day ago.
3. For comparison questions, highlight key differences (price, brand, pack size, supplier).
4. IMPORTANT: If a product has "also_available_at" entries, that means the EXACT SAME product is stocked by another supplier too. In that case, explicitly compare the prices — e.g. "Product X costs AUD 45 at Henry Schein and AUD 41 at Adam Dental — Adam Dental is cheaper by AUD 4."
5. If the results are from a fallback search (no exact match), say: "We don't have an exact match, but here are the most similar products we carry."
6. If results are empty, apologize and suggest the user try different search terms.
7. Keep the response concise — the product cards below will show full details.
8. Do NOT invent prices, stock status, or product details not in the provided data.
9. When products were retrieved, end with a single brief line on its own (normal weight, not bold, not a question):
   "You can check live prices anytime by clicking Check live price on the product cards below."
   Do not offer to check prices for the user — the UI has buttons on each card. Only use a different closing line when no products were found.

FORMAT your reply in Markdown. Follow these rules strictly:

STRUCTURE (always):
1. Line 1 — exactly one sentence wrapped in **bold**. This is the direct answer (max ~25 words). Nothing else on line 1.
2. Blank line.
3. Details — normal-weight bullet list OR 1–2 short normal paragraphs. No bold headings.

WHEN TO USE **bold** (sparingly — max 4 bold phrases in the details section):
- The opening summary sentence (line 1 only) — entire sentence in bold.
- Supplier or product name at the START of a bullet, followed by a colon, e.g. "- **Henry Schein:** Nitrile Gloves Medium — AUD 52.00"
- The cheaper / recommended option when comparing, e.g. "(**cheaper at Adam Dental**)" or "**best price**"

WHEN NOT TO USE bold:
- Do NOT bold prices — write them as plain AUD 52.00 or $52.00 (the UI highlights them automatically).
- Do NOT bold whole bullet lines — only the label before the colon.
- Do NOT bold common words, verbs, or filler text.
- Do NOT bold the follow-up question on the last line — keep it normal weight.

BULLET FORMAT for comparisons (preferred):
- **Henry Schein:** Product Name — AUD 52.00, in stock, checked yesterday
- **Adam Dental:** Same product — AUD 48.50, in stock (**cheaper by AUD 3.50**)

Keep the response concise. Product cards below show full details.`;

// ---------------------------------------------------------------------------
// Turn 1: extract filters via tool call
// ---------------------------------------------------------------------------

export async function plannerTurn(
  message: string,
  history: ChatHistoryMessage[]
): Promise<SearchFilters> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: PLANNER_SYSTEM },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  const response = await chatClient.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    tools: [SEARCH_PRODUCTS_TOOL],
    tool_choice: { type: "function", function: { name: "searchProducts" } },
    temperature: 0,
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0] as
    | { function: { name: string; arguments: string } }
    | undefined;
  if (!toolCall || toolCall.function.name !== "searchProducts") {
    // Fallback: treat entire message as the query with no filters
    return { rewritten_query: message };
  }

  try {
    const args = JSON.parse(toolCall.function.arguments) as SearchFilters;
    if (!args.rewritten_query) args.rewritten_query = message;
    return args;
  } catch {
    return { rewritten_query: message };
  }
}

// ---------------------------------------------------------------------------
// Turn 2: stream the answer
// ---------------------------------------------------------------------------

export async function* answerTurn(
  userMessage: string,
  rows: ProductRow[],
  total: number,
  fallback: boolean
): AsyncGenerator<SseEvent> {
  const productsContext = rows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    supplier: r.supplier_name,
    price: r.price != null ? `${r.price} AUD` : "price not available",
    stock_status: r.stock_status,
    pack_size: r.pack_size,
    description: r.description?.slice(0, 200) || null,
    delivery: r.delivery_text,
    last_checked: r.last_checked_at,
    url: r.supplier_product_url,
    // Cross-supplier price comparison — same canonical product at other suppliers
    also_available_at: r.canonical_alternatives?.map((alt) => ({
      supplier: getSupplierDisplayName(alt.supplier_slug, alt.supplier_name),
      price: alt.price != null ? `${alt.price} AUD` : "price not available",
      name: alt.name,
    })) ?? [],
  }));

  const hasCanonicalMatches = rows.some((r) => r.canonical_alternatives && r.canonical_alternatives.length > 0);
  const contextBlock =
    rows.length === 0
      ? "No products found."
      : [
          fallback ? "[FALLBACK SEARCH — no exact filter match]" : "",
          `Found ${total} total matching products. Showing top ${rows.length}:`,
          hasCanonicalMatches
            ? "NOTE: Some products include 'also_available_at' showing the same product at other suppliers — use this for price comparisons."
            : "",
          "",
          JSON.stringify(productsContext, null, 2),
        ]
          .filter(Boolean)
          .join("\n");

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: ANSWER_SYSTEM },
    {
      role: "user",
      content: `User asked: "${userMessage}"\n\nRetrieved products:\n${contextBlock}`,
    },
  ];

  const stream = await chatClient.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.3,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield { type: "token", text: delta };
    }
  }

  // After text stream, emit the structured products payload
  const productCards: ProductCardData[] = rows.map((r) => {
    const imageUrls = buildProductImageUrls(r.image_src, r.supplier_slug, r.external_sku);
    return {
      id: r.id,
      supplier: getSupplierDisplayName(r.supplier_slug, r.supplier_name),
      supplier_slug: r.supplier_slug,
      name: r.name,
      price: r.price ?? 0,
      currency: r.currency ?? "AUD",
      stockStatus: (r.stock_status ?? "unknown") as ProductCardData["stockStatus"],
      deliveryText: r.delivery_text ?? "",
      lastCheckedAt: r.last_checked_at ?? new Date().toISOString(),
      lastCheckedAgo: formatLastCheckedAgo(r.last_checked_at),
      freshness: computeFreshness(r.last_checked_at),
      imageUrl: imageUrls[0],
      imageUrls,
      url: r.supplier_product_url || undefined,
      alternatives: r.canonical_alternatives?.map((alt) => ({
        supplier: getSupplierDisplayName(alt.supplier_slug, alt.supplier_name),
        supplier_slug: alt.supplier_slug,
        price: alt.price,
        currency: alt.currency,
        url: alt.supplier_product_url,
        name: alt.name,
      })),
    };
  });

  yield { type: "products", products: productCards, total, fallback };
  yield { type: "done" };
}
