import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("slug, name, is_active")
    .order("name");

  const dbConnected = !error;
  const supplierCount = suppliers?.length ?? 0;

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-6 py-16">
      <main className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Ovie Compare</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Dental supplier comparison
        </h1>
        <p className="mt-3 text-zinc-600">
          Compare products across Henry Schein and Adam Dental.
        </p>

        <div
          className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
            dbConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {dbConnected ? (
            <>
              <strong>Database connected.</strong> {supplierCount} supplier
              {supplierCount === 1 ? "" : "s"} loaded.
              {supplierCount > 0 && (
                <ul className="mt-2 list-inside list-disc">
                  {suppliers?.map((s) => (
                    <li key={s.slug}>{s.name}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <strong>Database not ready.</strong> Run the SQL migration in
              Supabase, then refresh.
              {error?.message && (
                <p className="mt-1 text-xs opacity-80">{error.message}</p>
              )}
            </>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/chat"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Open chat
          </Link>
          <a
            href="/chat"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-300 px-5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Open in new tab
          </a>
        </div>
      </main>
    </div>
  );
}
