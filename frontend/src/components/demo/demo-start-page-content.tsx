import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";

export function DemoStartPageContent() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-stone-900">
      <header className="flex items-center px-6 py-5 sm:px-10">
        <Button variant="ghost" size="sm" render={<Link href={ROUTES.demo} />}>
          <ArrowLeft className="size-3.5" />
          Demo hub
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Codebase structure</h1>
        <p className="mt-3 text-lg text-stone-500">Frontend and Backend</p>
      </main>
    </div>
  );
}
