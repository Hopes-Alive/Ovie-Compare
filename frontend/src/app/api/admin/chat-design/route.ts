const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const body = await request.text();

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/chat-design`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "Backend unavailable" }, { status: 503 });
  }
}

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/chat-design`, { cache: "no-store" });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "Backend unavailable" }, { status: 503 });
  }
}
