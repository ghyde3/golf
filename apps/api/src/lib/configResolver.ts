interface ClubConfigRow {
  effectiveFrom: string;
  slotIntervalMinutes: number | null;
  openTime: string | null;
  closeTime: string | null;
  schedule: unknown;
  timezone: string | null;
  cancellationHours?: number | null;
  [key: string]: unknown;
}

interface ScheduleEntry {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export function resolveConfig(
  configs: ClubConfigRow[],
  targetDate: Date
): ClubConfigRow {
  const target = targetDate.toISOString().split("T")[0];
  const applicable = configs
    .filter((c) => c.effectiveFrom <= target)
    .sort((a, b) => (a.effectiveFrom > b.effectiveFrom ? -1 : 1));
  return applicable[0] ?? configs[0];
}

export function resolveHours(
  config: ClubConfigRow,
  dayOfWeek: number
): { openTime: string; closeTime: string } {
  const schedule = config.schedule as ScheduleEntry[] | null;
  if (schedule && Array.isArray(schedule)) {
    const entry = schedule.find((s) => s.dayOfWeek === dayOfWeek);
    if (entry) {
      return { openTime: entry.openTime, closeTime: entry.closeTime };
    }
  }
  return {
    openTime: config.openTime ?? "06:00",
    closeTime: config.closeTime ?? "18:00",
  };
}
