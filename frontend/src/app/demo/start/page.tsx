import type { Metadata } from "next";

import { DemoStartPageContent } from "@/components/demo/demo-start-page-content";

export const metadata: Metadata = {
  title: "Start demo | Ovie",
  description: "Blank paper-and-pen themed demo canvas",
};

export default function DemoStartPage() {
  return <DemoStartPageContent />;
}
