import Link from "next/link";
import { clubManageApi } from "../../../../../lib/admin-api";

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

export default async function ClubDashboardPage({
  params,
}: {
  params: { clubId: string };
}) {
  const res = await clubManageApi(params.clubId, "/summary");
  const summary = res.ok
    ? ((await res.json()) as Summary)
    : null;

  if (!summary) {
    return (
      <p className="text-stone-400">
        Could not load club summary. You may not have access.
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-2">Dashboard</h1>
      <p className="text-stone-400 text-sm mb-8">
        Country club operations — tee sheet and deeper tools will plug in here.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Stat label="Courses" value={summary.coursesCount} />
        <Stat label="Bookings today" value={summary.bookingsToday} />
        <Stat
          label="Status"
          value={summary.status === "suspended" ? "Suspended" : "Active"}
        />
        <Stat
          label="Timezone"
          value={summary.currentConfig?.timezone ?? "—"}
        />
      </div>

      <div className="rounded-xl border border-stone-800 bg-stone-900 p-6 max-w-lg">
        <h2 className="text-sm font-medium text-stone-300 mb-3">
          Active configuration
        </h2>
        {summary.currentConfig ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Effective from</dt>
              <dd className="text-stone-200 font-mono text-xs">
                {summary.currentConfig.effectiveFrom}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Tee interval</dt>
              <dd className="text-stone-200">
                {summary.currentConfig.slotIntervalMinutes ?? "—"} min
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Booking window</dt>
              <dd className="text-stone-200">
                {summary.currentConfig.bookingWindowDays ?? "—"} days
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-stone-500 text-sm">No configuration on file.</p>
        )}
        <Link
          href={`/book/${summary.slug}`}
          className="inline-block mt-6 text-sm text-amber-400 hover:text-amber-300"
        >
          View public booking →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900 p-4">
      <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
