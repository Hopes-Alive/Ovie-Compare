import Link from "next/link";
import { Caveat } from "next/font/google";
import { ArrowLeft, NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PaperSketchBackground } from "@/components/demo/paper-sketch-background";
import { ROUTES } from "@/config/routes";

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export function DemoStartPageContent() {
  return (
    <div className={`${caveat.variable} relative flex min-h-screen flex-col text-stone-800`}>
      <PaperSketchBackground />

      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Button variant="ghost" size="sm" render={<Link href={ROUTES.demo} />}>
          <ArrowLeft className="size-3.5" />
          Demo hub
        </Button>
        <div className="flex items-center gap-2 text-stone-500">
          <NotebookPen className="size-4" />
          <span className="text-xs font-medium tracking-wide uppercase">Live demo</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <h1
          className="text-5xl text-stone-800 sm:text-6xl"
          style={{ fontFamily: "var(--font-caveat)" }}
        >
          Start demo
        </h1>
        <p className="mt-3 max-w-md text-sm text-stone-500">
          A blank canvas — the walkthrough content goes here.
        </p>

        <div className="mt-10 flex h-64 w-full max-w-2xl items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-white/40 backdrop-blur-sm">
          <span className="text-2xl text-stone-400" style={{ fontFamily: "var(--font-caveat)" }}>
            (blank canvas)
          </span>
        </div>
      </main>
    </div>
  );
}
