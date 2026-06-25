"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_NAV_ITEMS } from "@/config/nav";
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
      <aside className="hidden w-56 shrink-0 border-r border-border bg-sidebar md:block">
        <div className="sticky top-0 flex h-full flex-col p-4">
          <div className="mb-6 px-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ovie Admin
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Operations
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {ADMIN_NAV_ITEMS.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <nav className="flex gap-1 overflow-x-auto border-b border-border bg-sidebar px-4 py-2 md:hidden">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
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
