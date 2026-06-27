import type { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const assetPath = path.join("/");

  try {
    const res = await fetch(`${BACKEND_URL}/uploads/${assetPath}`, { cache: "no-store" });
    if (!res.ok) {
      return new Response("Not found", { status: res.status });
    }
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Backend unavailable", { status: 503 });
  }
}
