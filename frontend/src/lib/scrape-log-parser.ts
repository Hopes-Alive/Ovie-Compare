export type ScrapeLogLine = {
  id: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type ActivityLevel = "neutral" | "success" | "warning" | "error";

export type ActivityFieldChange = {
  field: string;
  label: string;
  from: string;
  to: string;
};

export type ActivityEvent = {
  id: string;
  time: string;
  level: ActivityLevel;
  icon: "start" | "phase" | "category" | "added" | "updated" | "summary" | "warning" | "error" | "cancel" | "done";
  title: string;
  detail?: string;
  changes?: ActivityFieldChange[];
  supplierSlug?: string;
  supplierName?: string;
  pageUrl?: string;
  pageLinkLabel?: string;
};

export type ScrapeActivitySummary = {
  added: number;
  updated: number;
  unchanged: number;
  issues: number;
  categoriesChecked: number;
};

export type SupplierActivityGroup = {
  slug: string;
  name: string;
  status: "waiting" | "running" | "done" | "cancelled" | "failed";
  events: ActivityEvent[];
  summary: ScrapeActivitySummary;
  headline: string;
};

export type ScrapeActivityState = {
  summary: ScrapeActivitySummary;
  groups: SupplierActivityGroup[];
  globalEvents: ActivityEvent[];
  headline: string;
  isComplete: boolean;
  wasCancelled: boolean;
};

const SUPPLIER_LABELS: Record<string, string> = {
  "henry-schein": "Henry Schein Australia",
  "adam-dental": "Adam Dental",
};

function supplierName(slug: string | undefined, fallback?: string): string {
  if (!slug) return fallback ?? "Supplier";
  return SUPPLIER_LABELS[slug] ?? slug;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPrice(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return undefined;
  return `$${n.toFixed(2)}`;
}

function parseChangesFromMetadata(meta: Record<string, unknown>): ActivityFieldChange[] {
  const raw = meta.changes;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => ({
      field: String(item.field ?? ""),
      label: String(item.label ?? item.field ?? "Field"),
      from: String(item.from ?? "—"),
      to: String(item.to ?? "—"),
    }))
    .filter((c) => c.label.length > 0);
}

function buildPriceChangeFallback(
  oldPrice: unknown,
  newPrice: unknown,
): ActivityFieldChange[] {
  const oldP = formatPrice(oldPrice);
  const newP = formatPrice(newPrice);
  if (!oldP && !newP) return [];
  if (oldP === newP) return [];
  return [{ field: "price", label: "Price", from: oldP ?? "—", to: newP ?? "—" }];
}

function parseChangesFromEditMessage(message: string): ActivityFieldChange[] {
  const dashIdx = message.indexOf(" — ");
  if (dashIdx === -1) return [];
  const summary = message.slice(dashIdx + 3).trim();
  if (!summary) return [];

  return summary.split("; ").flatMap((segment) => {
    const match = segment.match(/^(.+?):\s*(.+?)\s*→\s*(.+)$/);
    if (!match) return [];
    return [
      {
        field: match[1]!.toLowerCase().replace(/\s+/g, "_"),
        label: match[1]!.trim(),
        from: match[2]!.trim(),
        to: match[3]!.trim(),
      },
    ];
  });
}

function primaryChangeTitle(changes: ActivityFieldChange[], fallback: string): string {
  if (changes.length === 1) return `${changes[0]!.label} updated`;
  if (changes.length > 1) return `${changes.length} fields updated`;
  return fallback;
}

function resolvePageUrl(
  websiteBySlug: Map<string, string>,
  slug: string | undefined,
  options: { path?: unknown; absoluteUrl?: unknown },
): string | undefined {
  const absolute = typeof options.absoluteUrl === "string" ? options.absoluteUrl.trim() : "";
  if (absolute.startsWith("http://") || absolute.startsWith("https://")) {
    return absolute;
  }
  const path = typeof options.path === "string" ? options.path.trim() : "";
  if (!slug || !path) return undefined;
  const base = websiteBySlug.get(slug);
  if (!base) return undefined;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base.replace(/\/$/, "")}${normalizedPath}`;
}

function withPageLink(
  event: ActivityEvent,
  websiteBySlug: Map<string, string>,
  slug: string | undefined,
  options: { path?: unknown; absoluteUrl?: unknown; label: string },
): ActivityEvent {
  const pageUrl = resolvePageUrl(websiteBySlug, slug, options);
  if (!pageUrl) return event;
  return { ...event, pageUrl, pageLinkLabel: options.label };
}

function mapLevel(level: ScrapeLogLine["level"]): ActivityLevel {
  switch (level) {
    case "success":
      return "success";
    case "warn":
      return "warning";
    case "error":
      return "error";
    default:
      return "neutral";
  }
}

function formatStoppedSummary(stats: {
  added?: number;
  updated?: number;
  unchanged?: number;
}): string {
  const parts: string[] = [];
  if (stats.added) parts.push(`${stats.added} new`);
  if (stats.updated) parts.push(`${stats.updated} updated`);
  if (stats.unchanged) parts.push(`${stats.unchanged} unchanged`);
  return parts.length > 0 ? `${parts.join(", ")} — saved to database` : "Progress saved to database";
}

function parseStatsFromMetadata(meta: Record<string, unknown>): Partial<ScrapeActivitySummary> | null {
  const raw = meta.stats;
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  return {
    added: typeof s.created === "number" ? s.created : 0,
    updated: typeof s.updated === "number" ? s.updated : 0,
    unchanged: typeof s.unchanged === "number" ? s.unchanged : 0,
    issues: typeof s.failed === "number" ? s.failed : 0,
  };
}

function parseCancelledStats(message: string): Partial<ScrapeActivitySummary> | null {
  const modern = message.match(
    /\+(\d+) added, ~(\d+) updated, (\d+) unchanged/,
  );
  if (modern) {
    return {
      added: Number(modern[1]),
      updated: Number(modern[2]),
      unchanged: Number(modern[3]),
    };
  }
  const legacy = message.match(/\(\+(\d+)\s*\/\s*~(\d+)\)/);
  if (legacy) {
    return { added: Number(legacy[1]), updated: Number(legacy[2]) };
  }
  return null;
}

function parseDoneStats(message: string): Partial<ScrapeActivitySummary> | null {
  const match = message.match(
    /\+(\d+) added, ~(\d+) edited, (\d+) unchanged, (\d+) failed/,
  );
  if (!match) return null;
  return {
    added: Number(match[1]),
    updated: Number(match[2]),
    unchanged: Number(match[3]),
    issues: Number(match[4]),
  };
}

function parseEvent(
  line: ScrapeLogLine,
  nameBySlug: Map<string, string>,
  websiteBySlug: Map<string, string>,
): ActivityEvent | null {
  const meta = line.metadata ?? {};
  const slug = typeof meta.supplier === "string" ? meta.supplier : undefined;
  const name = slug ? nameBySlug.get(slug) ?? supplierName(slug) : undefined;
  const time = formatTime(line.created_at);

  if (meta.action === "created") {
    const productName = String(meta.productName ?? "Product");
    const changes = parseChangesFromMetadata(meta);
    const price = formatPrice(meta.price);
    if (changes.length === 0 && price) {
      changes.push({ field: "price", label: "Price", from: "—", to: price });
    }
    return withPageLink(
      {
        id: line.id,
        time,
        level: "success",
        icon: "added",
        title: "New product added",
        detail: productName,
        changes,
        supplierSlug: slug,
        supplierName: name,
      },
      websiteBySlug,
      slug,
      { absoluteUrl: meta.url, label: "View product" },
    );
  }

  if (meta.action === "updated") {
    const productName = String(meta.productName ?? "Product");
    let changes = parseChangesFromMetadata(meta);
    if (changes.length === 0) {
      changes = buildPriceChangeFallback(meta.oldPrice, meta.newPrice);
    }
    if (changes.length === 0 && line.message.includes("~ EDIT")) {
      changes = parseChangesFromEditMessage(line.message);
    }
    return withPageLink(
      {
        id: line.id,
        time,
        level: "success",
        icon: "updated",
        title: primaryChangeTitle(changes, "Product updated"),
        detail: productName,
        changes,
        supplierSlug: slug,
        supplierName: name,
      },
      websiteBySlug,
      slug,
      { absoluteUrl: meta.url, label: "View product" },
    );
  }

  if (line.message.includes("Starting refresh")) {
    return withPageLink(
      {
        id: line.id,
        time,
        level: "neutral",
        icon: "start",
        title: "Started price check",
        detail: name ? `Checking ${name} catalog` : undefined,
        supplierSlug: slug,
        supplierName: name,
      },
      websiteBySlug,
      slug,
      { path: "/", label: "Open website" },
    );
  }

  if (line.message.includes("Pass A —") || (meta.pass === "A" && line.message.includes("Pass A"))) {
    const countMatch = line.message.match(/Pass A — (\d+)\/(\d+) categories/);
    const detail = countMatch
      ? `Reviewing ${countMatch[1]} of ${countMatch[2]} catalog sections`
      : "Reviewing supplier catalog sections";
    return {
      id: line.id,
      time,
      level: "neutral",
      icon: "phase",
      title: "Catalog scan",
      detail,
      supplierSlug: slug,
      supplierName: name,
    };
  }

  if (line.message.includes("Pass B —") || (meta.pass === "B" && line.message.includes("Pass B"))) {
    const countMatch = line.message.match(/Pass B — (\d+) product URLs/);
    return {
      id: line.id,
      time,
      level: "neutral",
      icon: "phase",
      title: "Product detail check",
      detail: countMatch
        ? `Re-checking ${countMatch[1]} individual product pages`
        : "Re-checking individual product pages",
      supplierSlug: slug,
      supplierName: name,
    };
  }

  if (line.message.includes("Pass B skipped")) {
    return {
      id: line.id,
      time,
      level: "neutral",
      icon: "phase",
      title: "Detail check skipped",
      detail: "Only catalog sections were checked this run",
      supplierSlug: slug,
      supplierName: name,
    };
  }

  if (meta.category && line.message.includes("Page ")) {
    const category = String(meta.category);
    return withPageLink(
      {
        id: line.id,
        time,
        level: "neutral",
        icon: "category",
        title: "Checking section",
        detail: category,
        supplierSlug: slug,
        supplierName: name,
      },
      websiteBySlug,
      slug,
      { path: meta.categoryPath, label: "Open section" },
    );
  }

  if (typeof meta.unchanged === "number" && meta.category) {
    return withPageLink(
      {
        id: line.id,
        time,
        level: "success",
        icon: "summary",
        title: "Section up to date",
        detail: `${meta.unchanged} products unchanged in ${meta.category}`,
        supplierSlug: slug,
        supplierName: name,
      },
      websiteBySlug,
      slug,
      { path: meta.categoryPath, label: "Open section" },
    );
  }

  if (line.message.includes("No products on")) {
    const category = String(meta.category ?? "this section");
    return withPageLink(
      {
        id: line.id,
        time,
        level: "warning",
        icon: "warning",
        title: "No products found",
        detail: `Nothing listed under ${category}`,
        supplierSlug: slug,
        supplierName: name,
      },
      websiteBySlug,
      slug,
      { path: meta.categoryPath, label: "Open section" },
    );
  }

  if (line.message.includes("Failed category")) {
    const category = String(meta.category ?? "a section");
    const errMatch = line.message.match(/Failed category [^:]+: (.+)$/);
    return withPageLink(
      {
        id: line.id,
        time,
        level: "error",
        icon: "error",
        title: "Section could not be checked",
        detail: errMatch?.[1] ? `${category} — ${errMatch[1]}` : category,
        supplierSlug: slug,
        supplierName: name,
      },
      websiteBySlug,
      slug,
      { path: meta.categoryPath, label: "Open section" },
    );
  }

  if (line.message.includes("Cancel requested")) {
    return {
      id: line.id,
      time,
      level: "warning",
      icon: "cancel",
      title: "Stop requested",
      detail: "Finishing the current step, then saving progress",
      supplierSlug: slug,
      supplierName: name,
    };
  }

  if (line.message.includes("Cancelled —")) {
    const fromMeta = parseStatsFromMetadata(meta);
    const fromMessage = parseCancelledStats(line.message);
    const stats = fromMeta ?? fromMessage;
    return {
      id: line.id,
      time,
      level: "warning",
      icon: "cancel",
      title: "Stopped early",
      detail: stats
        ? formatStoppedSummary(stats)
        : "Progress saved to database",
      supplierSlug: slug,
      supplierName: name,
    };
  }

  if (line.message.includes("Done —")) {
    const stats = parseDoneStats(line.message);
    const parts: string[] = [];
    if (stats?.added) parts.push(`${stats.added} new`);
    if (stats?.updated) parts.push(`${stats.updated} updated`);
    if (stats?.unchanged) parts.push(`${stats.unchanged} unchanged`);
    if (stats?.issues) parts.push(`${stats.issues} issues`);
    return {
      id: line.id,
      time,
      level: stats?.issues ? "warning" : "success",
      icon: "done",
      title: stats?.issues ? "Finished with issues" : "Finished successfully",
      detail: parts.length > 0 ? parts.join(" · ") : "No changes this run",
      supplierSlug: slug,
      supplierName: name,
    };
  }

  if (line.message.includes("Failed:") && line.level === "error") {
    const errMatch = line.message.match(/Failed: (.+)$/);
    return {
      id: line.id,
      time,
      level: "error",
      icon: "error",
      title: "Scrape failed",
      detail: errMatch?.[1] ?? line.message,
      supplierSlug: slug,
      supplierName: name,
    };
  }

  if (line.message.includes("✗") && meta.url) {
    const isParseFailed = line.message.includes("parse failed");
    const detail = line.message
      .replace(/^\[[^\]]+\]\s*✗\s*/, "")
      .replace(" — parse failed", "");
    return withPageLink(
      {
        id: line.id,
        time,
        level: "error",
        icon: "error",
        title: isParseFailed ? "Could not read product page" : "Product check failed",
        detail,
        supplierSlug: slug,
        supplierName: name,
      },
      websiteBySlug,
      slug,
      { absoluteUrl: meta.url, label: "View product" },
    );
  }

  // Skip raw technical lines (unchanged dots, bare errors already handled)
  if (line.message.includes("unchanged on") && !meta.unchanged) return null;
  if (line.message.startsWith("[") && line.message.includes("+ ADD")) return null;
  if (line.message.startsWith("[") && line.message.includes("~ EDIT")) return null;

  return null;
}

function emptyGroupSummary(): ScrapeActivitySummary {
  return { added: 0, updated: 0, unchanged: 0, issues: 0, categoriesChecked: 0 };
}

export function createWaitingSupplierGroup(slug: string, name: string): SupplierActivityGroup {
  return {
    slug,
    name,
    status: "waiting",
    events: [],
    summary: emptyGroupSummary(),
    headline: "Waiting to start…",
  };
}

function applyEventToSummary(
  summary: ScrapeActivitySummary,
  event: ActivityEvent,
  line: ScrapeLogLine,
): void {
  if (event.icon === "category") summary.categoriesChecked++;
  if (event.icon === "added") summary.added++;
  if (event.icon === "updated") summary.updated++;
  if (event.icon === "summary") {
    const n = line.metadata?.unchanged;
    if (typeof n === "number") summary.unchanged += n;
  }
  if (event.level === "error") summary.issues++;
}

function applyFinalStatsToSummary(
  summary: ScrapeActivitySummary,
  stats: Partial<ScrapeActivitySummary>,
): void {
  summary.added = Math.max(summary.added, stats.added ?? 0);
  summary.updated = Math.max(summary.updated, stats.updated ?? 0);
  summary.unchanged = Math.max(summary.unchanged, stats.unchanged ?? 0);
  summary.issues = Math.max(summary.issues, stats.issues ?? 0);
}

export function buildScrapeActivityState(
  logs: ScrapeLogLine[],
  supplierNames: Record<string, string> = {},
  supplierWebsites: Record<string, string> = {},
): ScrapeActivityState {
  const nameBySlug = new Map<string, string>([
    ...Object.entries(SUPPLIER_LABELS),
    ...Object.entries(supplierNames),
  ]);
  const websiteBySlug = new Map<string, string>(Object.entries(supplierWebsites));

  const summary: ScrapeActivitySummary = {
    added: 0,
    updated: 0,
    unchanged: 0,
    issues: 0,
    categoriesChecked: 0,
  };

  const groupMap = new Map<string, SupplierActivityGroup>();
  const globalEvents: ActivityEvent[] = [];
  let headline = "Waiting to start";
  let isComplete = false;
  let wasCancelled = false;

  for (const line of logs) {
    const event = parseEvent(line, nameBySlug, websiteBySlug);
    if (!event) continue;

    const slug = event.supplierSlug;
    if (!slug) {
      globalEvents.push(event);
    } else {
      if (!groupMap.has(slug)) {
        groupMap.set(slug, {
          slug,
          name: event.supplierName ?? supplierName(slug),
          status: "running",
          events: [],
          summary: emptyGroupSummary(),
          headline: "Starting…",
        });
      }
      const group = groupMap.get(slug)!;
      group.events.push(event);
      applyEventToSummary(group.summary, event, line);
      if (event.detail) group.headline = event.detail;
      else if (event.title) group.headline = event.title;
    }

    if (slug) {
      applyEventToSummary(summary, event, line);
    }

    if (event.icon === "done") {
      const stats = parseDoneStats(
        logs.find((l) => l.id === line.id)?.message ?? "",
      );
      if (stats) {
        applyFinalStatsToSummary(summary, stats);
        if (slug && groupMap.has(slug)) {
          applyFinalStatsToSummary(groupMap.get(slug)!.summary, stats);
        }
      }
      if (slug && groupMap.has(slug)) {
        groupMap.get(slug)!.status = event.level === "warning" ? "failed" : "done";
      }
      headline = event.detail ?? event.title;
      isComplete = true;
    }

    if (event.icon === "cancel" && event.title === "Stopped early") {
      const cancelStats =
        parseStatsFromMetadata(line.metadata ?? {}) ?? parseCancelledStats(line.message);
      if (cancelStats) {
        applyFinalStatsToSummary(summary, cancelStats);
        if (slug && groupMap.has(slug)) {
          applyFinalStatsToSummary(groupMap.get(slug)!.summary, cancelStats);
        }
      }
      if (slug && groupMap.has(slug)) {
        groupMap.get(slug)!.status = "cancelled";
      }
      wasCancelled = true;
      headline = event.detail ?? "Stopped early — progress saved";
      isComplete = true;
    }

    if (event.icon === "start") headline = event.detail ?? "Scrape in progress…";
    if (event.icon === "phase") headline = event.detail ?? event.title;
    if (event.icon === "category") headline = `Checking ${event.detail ?? "catalog"}…`;
  }

  const groups = [...groupMap.values()];
  groups.sort((a, b) => a.name.localeCompare(b.name));

  return { summary, groups, globalEvents, headline, isComplete, wasCancelled };
}
