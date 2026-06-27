export const fmtNum = (n: number | string) =>
  typeof n === "number" ? n.toLocaleString() : n;

export const fmtPercent = (n: number) => `${Math.round(n)}%`;

export function filterByDateRange<T extends { date: string }>(
  rows: T[],
  from: string,
  to: string
): T[] {
  if (!from && !to) return rows;

  return rows.filter((row) => {
    if (from && row.date < from) return false;
    if (to && row.date > to) return false;
    return true;
  });
}

export function aggregateByWeekday(
  rows: { date: string; count: number }[]
): { day: string; count: number }[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDay = [0, 0, 0, 0, 0, 0, 0];

  for (const { date, count } of rows) {
    const dayIndex = new Date(`${date}T12:00:00Z`).getUTCDay();
    byDay[dayIndex] += count;
  }

  return byDay.map((count, index) => ({ day: labels[index], count }));
}

export function topDaysByCount(
  rows: { date: string; count: number }[],
  limit = 7
): { date: string; count: number }[] {
  return [...rows]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ date, count }) => ({
      date: new Date(`${date}T12:00:00Z`).toLocaleDateString("en-AU", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      count,
    }));
}
