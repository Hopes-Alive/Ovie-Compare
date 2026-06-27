import { Crown } from "lucide-react";

import { AdminPanel } from "@/components/admin/shell/admin-panel";
import type { TopQuery } from "@/types/admin";

import { fmtNum } from "./utils";

type TopQueriesPanelProps = {
  queries: TopQuery[];
};

export function TopQueriesPanel({ queries }: TopQueriesPanelProps) {
  return (
    <AdminPanel title="Top search queries">
      <div className="overflow-x-auto rounded-md border border-[var(--admin-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-bg)] text-left text-xs text-[var(--admin-muted)]">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Query</th>
              <th className="px-3 py-2 font-medium">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {queries.map((row) => (
              <tr key={row.rank} className="hover:bg-[var(--admin-bg)]">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {row.rank === 1 && (
                      <Crown className="size-3.5 text-[var(--admin-muted)]" />
                    )}
                    <span className="tabular-nums">{row.rank}</span>
                  </div>
                </td>
                <td className="px-3 py-2">{row.query}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(row.count)}</td>
              </tr>
            ))}
            {queries.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-[var(--admin-muted)]" colSpan={3}>
                  No searches in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminPanel>
  );
}
