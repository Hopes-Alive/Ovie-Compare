import Link from "next/link";

import { ConnectedSuppliers } from "@/components/landing/connected-suppliers";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { QrCodeCard } from "@/components/landing/qr-code-card";
import { Button } from "@/components/ui/button";
import { ROUTES, getChatUrlFromEnv } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";

export async function LandingPage() {
  const supabase = await createClient();
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("slug, name, is_active")
    .order("name");

  const chatUrl = getChatUrlFromEnv();

  return (
    <div className="flex min-h-full flex-col bg-zinc-50/80">
      <LandingHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-6 py-12">
        <LandingHero />
        <QrCodeCard chatUrl={chatUrl} />
        <ConnectedSuppliers
          suppliers={suppliers}
          dbConnected={!error}
          errorMessage={error?.message}
        />
        <div className="flex justify-center pt-2">
          <Button size="lg" render={<Link href={ROUTES.chat} />}>
            Open chat
          </Button>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
