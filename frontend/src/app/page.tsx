import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Ovie Compare — Dental supplier comparison",
  description: "Compare dental supplies across Australian suppliers",
};

export default function Home() {
  return <LandingPage />;
}
