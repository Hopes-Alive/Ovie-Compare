import {
  Activity,
  Briefcase,
  Building2,
  LayoutDashboard,
  MessageSquare,
  Network,
  Palette,
} from "lucide-react";

import { ROUTES } from "@/config/routes";

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

export const CHAT_SUGGESTED_PROMPTS = [
  "Who has the cheapest nitrile gloves?",
  "Find composite A2 in stock",
  "Compare sterilisation pouches across suppliers",
] as const;

export const CONNECTED_SUPPLIERS = [
  { slug: "henry-schein", name: "Henry Schein" },
  { slug: "adam-dental", name: "Adam Dental" },
] as const;
