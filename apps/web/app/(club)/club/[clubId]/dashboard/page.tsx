import { clubApi, clubManageApi } from "@/lib/admin-api";
import { DashboardClient } from "./DashboardClient";
import type { TeeSlotRow } from "@/components/teesheet/types";

type Summary = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  coursesCount: number;
  bookingsToday: number;
  currentConfig: {
    effectiveFrom: string;
    slotIntervalMinutes: number | null;
    bookingWindowDays: number | null;
    timezone: string | null;
    primaryColor: string | null;
  } | null;
};

type Course = { id: string; name: string; holes: number };

function pctBooked(slots: TeeSlotRow[]): number {
  if (slots.length === 0) return 0;
  const booked = slots.filter(
    (s) => s.bookedPlayers > 0 && s.status !== "blocked"
  ).length;
  return (booked / slots.length) * 100;
}

function revenueFromSlots(slots: TeeSlotRow[]): number {
  let total = 0;
  for (const s of slots) {
    if (s.bookedPlayers <= 0 || s.status === "blocked") continue;
    const p = s.price ?? 0;
    total += p * s.bookedPlayers;
  }
  return total;
}

export default async function ClubDashboardPage({
  params,
  searchParams,
}: {
  params: { clubId: string };
  searchParams: { date?: string };
}) {
  const dateStr =
    searchParams.date ?? new Date().toISOString().split("T")[0];

  const [res, reportsRes] = await Promise.all([
    clubManageApi(params.clubId, "/summary"),
    clubManageApi(params.clubId, "/reports?days=7"),
  ]);
  const summary = res.ok ? ((await res.json()) as Summary) : null;
  const reports = reportsRes.ok ? await reportsRes.json() : null;
  const sparklineSeries: { date: string; bookings: number }[] =
    reports?.series ?? [];

  if (!summary) {
    return (
      <p className="p-6 text-muted">
        Could not load club summary. You may not have access.
      </p>
    );
  }

  const coursesRes = await clubApi(params.clubId, "/courses");
  const courses: Course[] = coursesRes.ok
    ? ((await coursesRes.json()) as Course[])
    : [];

  const coursesWithSlots: {
    id: string;
    name: string;
    slots: TeeSlotRow[];
  }[] = [];

  for (const c of courses) {
    const ts = await clubApi(
      params.clubId,
      `/courses/${c.id}/teesheet?date=${encodeURIComponent(dateStr)}`
    );
    const slots: TeeSlotRow[] = ts.ok ? ((await ts.json()) as TeeSlotRow[]) : [];
    coursesWithSlots.push({ id: c.id, name: c.name, slots });
  }

  const allSlots = coursesWithSlots.flatMap((c) => c.slots);
  const utilisationPct =
    coursesWithSlots.length === 0
      ? 0
      : coursesWithSlots.reduce((acc, c) => acc + pctBooked(c.slots), 0) /
        coursesWithSlots.length;

  const revenueToday = revenueFromSlots(allSlots);
  const noShows = 0;

  const courseUtils = coursesWithSlots.map((c) => {
    const total = c.slots.length;
    const booked = c.slots.filter(
      (s) => s.bookedPlayers > 0 && s.status !== "blocked"
    ).length;
    const pct = total === 0 ? 0 : (booked / total) * 100;
    return {
      id: c.id,
      name: c.name,
      pct,
      booked,
      total,
    };
  });

  const fullyBooked = courseUtils
    .filter((c) => c.pct >= 100 && c.total > 0)
    .map((c) => ({ name: c.name }));

  return (
    <DashboardClient
      clubId={params.clubId}
      dateStr={dateStr}
      sparklineSeries={sparklineSeries}
      summary={{
        bookingsToday: summary.bookingsToday,
        slug: summary.slug,
      }}
      stats={{
        utilisationPct,
        revenueToday,
        noShows,
      }}
      courseUtils={courseUtils}
      coursesWithSlots={coursesWithSlots}
      alerts={{
        noShows: noShows > 0,
        fullyBooked,
        overnight: false,
      }}
    />
  );
}
