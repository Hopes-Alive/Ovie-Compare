import type { Metadata } from "next";

import { OverviewDashboard } from "@/components/admin/overview-dashboard";
import { getChatUrlFromEnv } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Overview | Ovie Admin",
};

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("slug, name, base_url, is_active")
    .order("name");

  const chatUrl = getChatUrlFromEnv();

  return (
    <OverviewDashboard chatUrl={chatUrl} suppliers={suppliers ?? []} />
  );
}
