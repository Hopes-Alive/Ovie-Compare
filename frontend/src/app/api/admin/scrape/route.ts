const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export const dynamic = "force-dynamic";

async function proxy(path: string, init?: RequestInit) {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: "no-store", ...init });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST() {
  try {
    return proxy("/api/admin/scrape/start", { method: "POST" });
  } catch {
    return Response.json({ error: "Backend unavailable" }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    return proxy("/api/admin/scrape/cancel", { method: "POST" });
  } catch {
    return Response.json({ error: "Backend unavailable" }, { status: 503 });
  }
}
