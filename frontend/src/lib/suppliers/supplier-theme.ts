/** Shared visual identity per supplier — sections, cards, badges. */

export type SupplierTheme = {
  /** Full supplier section background */
  sectionBg: string;
  sectionBorder: string;
  /** Section header strip */
  headerBg: string;
  headerBorder: string;
  titleText: string;
  /** Icon tile in section header */
  iconBg: string;
  iconText: string;
  /** Product cards nested inside the section */
  cardBg: string;
  cardBorder: string;
  cardHover: string;
  /** Badge pill */
  badge: string;
  /** Accent for prices / highlights */
  accentText: string;
  accentBg: string;
  /** Comparison summary chip */
  chip: string;
  /** Price bar fill in comparisons */
  barFill: string;
};

const DEFAULT_THEME: SupplierTheme = {
  sectionBg: "bg-muted/40",
  sectionBorder: "border-border",
  headerBg: "bg-muted/60",
  headerBorder: "border-border/60",
  titleText: "text-foreground",
  iconBg: "bg-muted",
  iconText: "text-muted-foreground",
  cardBg: "bg-background/95",
  cardBorder: "border-border/70",
  cardHover: "hover:shadow-md",
  badge: "border-border bg-muted text-foreground",
  accentText: "text-foreground",
  accentBg: "bg-muted",
  chip: "border-border bg-muted/80 text-foreground",
  barFill: "bg-muted-foreground/50",
};

const SUPPLIER_THEMES: Record<string, SupplierTheme> = {
  "henry-schein": {
    sectionBg: "bg-blue-50/90 dark:bg-blue-950/30",
    sectionBorder: "border-blue-200 dark:border-blue-800/80",
    headerBg: "bg-blue-100/80 dark:bg-blue-900/40",
    headerBorder: "border-blue-200/80 dark:border-blue-800/60",
    titleText: "text-blue-950 dark:text-blue-50",
    iconBg: "bg-blue-600",
    iconText: "text-white",
    cardBg: "bg-white/95 dark:bg-blue-950/20",
    cardBorder: "border-blue-200/70 dark:border-blue-800/50",
    cardHover: "hover:border-blue-300 hover:shadow-blue-100/50 dark:hover:border-blue-700",
    badge:
      "border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-900/60 dark:text-blue-100",
    accentText: "text-blue-800 dark:text-blue-200",
    accentBg: "bg-blue-100/80 dark:bg-blue-900/40",
    chip: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-100",
    barFill: "bg-blue-500",
  },
  "adam-dental": {
    sectionBg: "bg-teal-50/90 dark:bg-teal-950/30",
    sectionBorder: "border-teal-200 dark:border-teal-800/80",
    headerBg: "bg-teal-100/80 dark:bg-teal-900/40",
    headerBorder: "border-teal-200/80 dark:border-teal-800/60",
    titleText: "text-teal-950 dark:text-teal-50",
    iconBg: "bg-teal-600",
    iconText: "text-white",
    cardBg: "bg-white/95 dark:bg-teal-950/20",
    cardBorder: "border-teal-200/70 dark:border-teal-800/50",
    cardHover: "hover:border-teal-300 hover:shadow-teal-100/50 dark:hover:border-teal-700",
    badge:
      "border-teal-300 bg-teal-100 text-teal-900 dark:border-teal-700 dark:bg-teal-900/60 dark:text-teal-100",
    accentText: "text-teal-800 dark:text-teal-200",
    accentBg: "bg-teal-100/80 dark:bg-teal-900/40",
    chip: "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-100",
    barFill: "bg-teal-500",
  },
};

export function getSupplierTheme(slug?: string | null): SupplierTheme {
  if (slug && SUPPLIER_THEMES[slug]) {
    return SUPPLIER_THEMES[slug];
  }
  return DEFAULT_THEME;
}

export function getSupplierInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  }
  return (words[0]?.slice(0, 2) ?? "S").toUpperCase();
}
