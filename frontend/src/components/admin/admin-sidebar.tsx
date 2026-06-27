"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { ADMIN_NAV_GROUPS } from "@/config/nav";
import { ROUTES } from "@/config/routes";
import { cn } from "@/lib/utils";

function isNavActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/demo") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-56 shrink-0 border-r border-[var(--admin-border)] bg-[var(--admin-sidebar)] md:flex md:flex-col">
        <div className="flex h-full flex-col">
          <div className="px-4 py-5">
            <p className="text-sm font-semibold text-[var(--admin-foreground)]">
              Ovie
            </p>
            <p className="text-xs text-[var(--admin-muted)]">Admin</p>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-4">
            {ADMIN_NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-2 text-[11px] font-medium text-[var(--admin-muted)]">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = isNavActive(pathname, item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                          isActive
                            ? "bg-[var(--admin-sidebar-muted)] font-medium text-[var(--admin-foreground)]"
                            : "text-[var(--admin-secondary)] hover:bg-[var(--admin-sidebar-muted)] hover:text-[var(--admin-foreground)]"
                        )}
                      >
                        <Icon className="size-4 shrink-0 opacity-70" />
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-[var(--admin-border)] px-4 py-3">
            <a
              href={ROUTES.chat}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--admin-secondary)] hover:text-[var(--admin-foreground)]"
            >
              Open chat
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </aside>

      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--admin-border)] bg-[var(--admin-sidebar)] px-3 py-2 md:hidden">
        {ADMIN_NAV_GROUPS.flatMap((group) => group.items).map((item) => {
          const isActive = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
                isActive
                  ? "bg-[var(--admin-sidebar-muted)] font-medium text-[var(--admin-foreground)]"
                  : "text-[var(--admin-secondary)]"
              )}
            >
              {item.title}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
