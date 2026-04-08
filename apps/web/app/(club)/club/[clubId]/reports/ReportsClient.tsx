"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";
import Link from "next/link";
import { useCallback, useState } from "react";

export type ReportsPayload = {
  days: number;
  series: {
    date: string;
    bookings: number;
    players: number;
    revenueGreenFees: number;
    revenueAddons: number;
    occupancyPct: number;
  }[];
  totals: {
    bookings: number;
    players: number;
    revenueGreenFees: number;
    revenueAddons: number;
    occupancyPct: number;
    sources: { online: number; staff: number };
  };
};

const PERIOD_OPTIONS = [7, 30, 90] as const;

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatDay(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function ReportsClient({
  clubId,
  data: initialData,
}: {
  clubId: string;
  data: ReportsPayload;
}) {
  const [days, setDays] = useState(initialData.days);
  const [data, setData] = useState<ReportsPayload>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPeriodChange = useCallback(
    async (next: number) => {
      setDays(next);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/clubs/${clubId}/manage/reports?days=${next}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          setError("Could not load reports.");
          return;
        }
        const json = (await res.json()) as ReportsPayload;
        setData(json);
      } catch {
        setError("Could not load reports.");
      } finally {
        setLoading(false);
      }
    },
    [clubId]
  );

  const maxBookings = Math.max(
    1,
    ...data.series.map((s) => s.bookings),
    data.totals.bookings
  );

  const totalRevenue =
    data.totals.revenueGreenFees + data.totals.revenueAddons;

  return (
    <>
      <SetTopBar title="Reports" />
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-sm text-muted">
            Booking activity for the last {data.days} days (UTC), matching how
            dashboard counts are computed.
          </p>
          <label className="flex shrink-0 items-center gap-2 text-sm text-ink">
            <span className="text-muted">Period</span>
            <select
              className="rounded-lg border border-stone bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway disabled:opacity-50"
              value={days}
              disabled={loading}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) void onPeriodChange(n);
              }}
            >
              {PERIOD_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm border-t-2 border-t-fairway">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Bookings ({data.days}d)
            </p>
            <p className="mt-2 font-display text-3xl text-ink">
              {data.totals.bookings}
            </p>
          </div>
          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm border-t-2 border-t-grass">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Player spots ({data.days}d)
            </p>
            <p className="mt-2 font-display text-3xl text-ink">
              {data.totals.players}
            </p>
          </div>
          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm border-t-2 border-t-gold">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Revenue ({data.days}d)
            </p>
            <p className="mt-2 font-display text-3xl text-ink">
              {usd.format(totalRevenue)}
            </p>
          </div>
          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm border-t-2 border-t-forest">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Occupancy % (avg)
            </p>
            <p className="mt-2 font-display text-3xl text-ink">
              {data.totals.occupancyPct}%
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-xl border border-stone bg-white shadow-sm">
          <div className="border-b border-stone px-4 py-3">
            <h3 className="font-display text-lg text-ink">Daily breakdown</h3>
          </div>
          {data.totals.bookings === 0 ? (
            <p className="border-b border-stone px-4 py-4 text-center text-sm text-muted">
              No bookings in this period yet. When guests book online or staff
              add bookings, they will appear here.
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <div className="min-w-[min(100%,520px)]">
              <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_88px_1fr] border-b border-stone bg-cream/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                <span>Date</span>
                <span className="text-right">Bookings</span>
                <span className="text-right">Players</span>
                <span className="text-right">Revenue</span>
                <span />
              </div>
              <div className="divide-y divide-stone">
                {data.series.map((s) => (
                  <div
                    key={s.date}
                    className="grid grid-cols-[minmax(0,1fr)_72px_72px_88px_1fr] items-center gap-2 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-ink">
                      {formatDay(s.date)}
                    </span>
                    <span className="text-right text-sm tabular-nums text-ink">
                      {s.bookings}
                    </span>
                    <span className="text-right text-sm tabular-nums text-ink">
                      {s.players}
                    </span>
                    <span className="text-right text-sm tabular-nums text-ink">
                      {usd.format(s.revenueGreenFees + s.revenueAddons)}
                    </span>
                    <div className="min-w-0">
                      <div className="h-2 overflow-hidden rounded-full bg-cream">
                        <div
                          className="h-full rounded-full bg-fairway/70"
                          style={{
                            width: `${Math.round((s.bookings / maxBookings) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted">
          For tee sheet and same-day detail, see{" "}
          <Link
            href={`/club/${clubId}/bookings`}
            className="font-semibold text-fairway hover:underline"
          >
            Bookings
          </Link>{" "}
          or{" "}
          <Link
            href={`/club/${clubId}/dashboard`}
            className="font-semibold text-fairway hover:underline"
          >
            Dashboard
          </Link>
          .
        </p>
      </div>
    </>
  );
}
