import {
  Activity,
  Briefcase,
  Building2,
  LayoutDashboard,
  MessageSquare,
  Network,
  QrCode,
} from "lucide-react";

import { ROUTES } from "@/config/routes";

export type DemoStep = {
  label: string;
  href: string;
  description: string;
};

export type DemoSection = {
  id: string;
  title: string;
  description: string;
  icon: typeof QrCode;
  steps: DemoStep[];
};

export const DEMO_SECTIONS: DemoSection[] = [
  {
    id: "public",
    title: "Public — clinic flow",
    description:
      "What a dental practice sees: scan QR, open chat, compare suppliers.",
    icon: QrCode,
    steps: [
      {
        label: "Landing",
        href: ROUTES.home,
        description: "Hero, QR code, chat URL, connected suppliers",
      },
      {
        label: "Chat",
        href: ROUTES.chat,
        description: "Conversational search, product cards, live price check",
      },
    ],
  },
  {
    id: "admin",
    title: "Admin — operations",
    description:
      "Internal dashboard for supplier health, jobs, and usage metrics.",
    icon: LayoutDashboard,
    steps: [
      {
        label: "Overview",
        href: ROUTES.admin.overview,
        description: "Summary cards, open chat, copy URL",
      },
      {
        label: "Suppliers",
        href: ROUTES.admin.suppliers,
        description: "Data sources, status, detail drawer",
      },
      {
        label: "Analytics",
        href: ROUTES.admin.analytics,
        description: "Sessions, live checks, top queries",
      },
      {
        label: "Jobs",
        href: ROUTES.admin.jobs,
        description: "Scrape and live-check logs with detail panel",
      },
      {
        label: "Architecture",
        href: ROUTES.admin.architecture,
        description: "System diagram and stack for stakeholders",
      },
    ],
  },
];

export const DEMO_FLOW_ORDER = [
  { step: 1, label: "Landing", href: ROUTES.home },
  { step: 2, label: "Chat (product search)", href: ROUTES.chat },
  { step: 3, label: "Admin overview", href: ROUTES.admin.overview },
  { step: 4, label: "Suppliers & jobs", href: ROUTES.admin.suppliers },
  { step: 5, label: "Analytics", href: ROUTES.admin.analytics },
  { step: 6, label: "Architecture", href: ROUTES.admin.architecture },
] as const;

export const ADMIN_NAV_ITEMS = [
  {
    title: "Overview",
    href: ROUTES.admin.overview,
    icon: LayoutDashboard,
  },
  {
    title: "Suppliers",
    href: ROUTES.admin.suppliers,
    icon: Building2,
  },
  {
    title: "Analytics",
    href: ROUTES.admin.analytics,
    icon: Activity,
  },
  {
    title: "Jobs",
    href: ROUTES.admin.jobs,
    icon: Briefcase,
  },
  {
    title: "Architecture",
    href: ROUTES.admin.architecture,
    icon: Network,
  },
  {
    title: "Demo hub",
    href: ROUTES.demo,
    icon: MessageSquare,
  },
] as const;

export const CHAT_SUGGESTED_PROMPTS = [
  "Who has the cheapest nitrile gloves?",
  "Find composite A2 in stock",
  "Compare sterilisation pouches across suppliers",
] as const;

export const CONNECTED_SUPPLIERS = [
  { slug: "henry-schein", name: "Henry Schein" },
  { slug: "adam-dental", name: "Adam Dental" },
] as const;
