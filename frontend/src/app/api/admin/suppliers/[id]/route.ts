const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.text();
    const res = await fetch(`${BACKEND_URL}/api/admin/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
