import type { ChatMessage } from "@/types/chat";

/** Set to false to show empty state with suggested prompts only. */
export const SHOW_DEMO = true;

// TODO: replace with POST /api/chat response
export const mockChatMessages: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: "Who has the cheapest medium nitrile gloves?",
  },
  {
    id: "msg-2",
    role: "assistant",
    content:
      "Based on data checked 2 hours ago, here are the cheapest medium nitrile gloves across connected suppliers. Pack sizes may differ — verify before ordering.",
    products: [
      {
        id: "prod-1",
        supplier: "Adam Dental",
        name: "Nitrile Gloves Medium 100pk",
        price: 5.95,
        currency: "AUD",
        stockStatus: "in_stock",
        deliveryText: "2–3 days",
        lastCheckedAt: "2026-06-24T08:00:00Z",
        lastCheckedAgo: "2h ago",
        freshness: "fresh",
      },
      {
        id: "prod-2",
        supplier: "Henry Schein",
        name: "Nitrile Exam Gloves Medium 200pk",
        price: 6.2,
        currency: "AUD",
        stockStatus: "in_stock",
        deliveryText: "3–5 days",
        lastCheckedAt: "2026-06-24T08:00:00Z",
        lastCheckedAgo: "2h ago",
        freshness: "fresh",
      },
    ],
  },
];
