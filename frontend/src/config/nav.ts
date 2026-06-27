import {
  Activity,
  Briefcase,
  Building2,
  LayoutDashboard,
  MessageSquare,
  Network,
  Palette,
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

export type AdminNavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Operations",
    items: [
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
        title: "Jobs",
        href: ROUTES.admin.jobs,
        icon: Briefcase,
      },
      {
        title: "Analytics",
        href: ROUTES.admin.analytics,
        icon: Activity,
      },
    ],
  },
  {
    label: "Configure",
    items: [
      {
        title: "Chat Design",
        href: ROUTES.admin.chatDesign,
        icon: Palette,
      },
    ],
  },
  {
    label: "Reference",
    items: [
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
    ],
  },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

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
        description: "Connected data sources and scrape health",
      },
      {
        label: "Jobs",
        href: ROUTES.admin.jobs,
        description: "Scrape and live-check logs with detail panel",
      },
      {
        label: "Analytics",
        href: ROUTES.admin.analytics,
        description: "Sessions, live checks, top queries",
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
  { step: 4, label: "Suppliers", href: ROUTES.admin.suppliers },
  { step: 5, label: "Jobs", href: ROUTES.admin.jobs },
  { step: 6, label: "Analytics", href: ROUTES.admin.analytics },
  { step: 7, label: "Architecture", href: ROUTES.admin.architecture },
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
