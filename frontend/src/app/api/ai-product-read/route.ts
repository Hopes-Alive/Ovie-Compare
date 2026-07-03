/**
 * Thin proxy — forwards POST /api/ai-product-read to the backend and pipes SSE back.
 */
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const body = await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/api/ai-product-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Backend server unavailable. Is the backend running?" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
