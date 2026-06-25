import Link from "next/link";

import { ROUTES } from "@/config/routes";

export function LandingHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href={ROUTES.home} className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">Ovie</span>
          <span className="text-xs text-muted-foreground">
            Compare dental supplies
          </span>
        </Link>
        <Link
          href={ROUTES.chat}
          className="text-sm font-medium text-foreground hover:underline"
        >
          Open chat
        </Link>
      </div>
    </header>
  );
}
