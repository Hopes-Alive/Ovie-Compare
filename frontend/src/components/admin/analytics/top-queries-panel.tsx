import { Crown } from "lucide-react";

import type { TopQuery } from "@/types/admin";

import { AnalyticsPanel } from "./panel";
import { fmtNum } from "./utils";

type TopQueriesPanelProps = {
  queries: TopQuery[];
};

export function TopQueriesPanel({ queries }: TopQueriesPanelProps) {
  return (
    <AnalyticsPanel title="Top Search Queries">
      <p className="mb-3 text-[13px] text-[#A8A39B]">
        Most common product searches from chat in the selected range.
      </p>
      <div className="overflow-x-auto rounded-lg border border-[#E5E3DF]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E3DF] bg-[#FAF9F7] text-left text-[#A8A39B]">
              <th className="py-3 pl-4 font-medium">#</th>
              <th className="py-3 font-medium">Query</th>
              <th className="py-3 pr-4 font-medium">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F7F5F0]">
            {queries.map((row) => (
              <tr key={row.rank} className="transition-colors hover:bg-[#FAF9F7]">
                <td className="py-3 pl-4">
                  <div className="flex items-center gap-1.5">
                    {row.rank === 1 && (
                      <Crown className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="font-medium tabular-nums text-[#1A1A1A]">
                      {row.rank}
                    </span>
                  </div>
                </td>
                <td className="py-3">
                  <span className="rounded-full border border-[#E5E3DF] bg-[#FAF9F7] px-3 py-1.5 text-[#1A1A1A]">
                    {row.query}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className="rounded-md border border-[#E5E3DF] bg-[#FAF9F7] px-2.5 py-1 font-medium tabular-nums text-[#1A1A1A]">
                    {fmtNum(row.count)}
                  </span>
                </td>
              </tr>
            ))}
            {queries.length === 0 && (
              <tr>
                <td
                  className="py-8 text-center text-[#A8A39B]"
                  colSpan={3}
                >
                  No searches in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AnalyticsPanel>
  );
}
