export function parseDay(day?: string): Date | null {
  if (!day) return null;
  const dt = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function toIsoDateOnly(date: Date): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}

export function resolveRange(from?: string, to?: string) {
  const today = new Date();
  const end =
    parseDay(to) ??
    new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );
  const start =
    parseDay(from) ??
    new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 29)
    );
  return { start, end };
}

export function endOfDayUtc(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

export function daysAgoUtc(days: number): Date {
  const today = new Date();
  return new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - days
    )
  );
}

export function eachDayInclusive(start: Date, end: Date): string[] {
  const days: string[] = [];
  for (
    let d = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
    );
    d.getTime() <= end.getTime();
    d = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
    )
  ) {
    days.push(toIsoDateOnly(d));
  }
  return days;
}
