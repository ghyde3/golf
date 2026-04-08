"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

function isPresetPeriod(d: number): d is (typeof PERIOD_OPTIONS)[number] {
  return (PERIOD_OPTIONS as readonly number[]).includes(d);
}

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
  const pathname = usePathname();
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const totalRevenueDisplay =
    data.totals.revenueGreenFees + data.totals.revenueAddons;

  const onPeriodChange = useCallback(
    async (nextDays: number) => {
      if (!token?.trim()) {
        setFetchError("Sign in to change the report period.");
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `${API_URL}/api/clubs/${clubId}/manage/reports?days=${nextDays}`,
          {
            headers: { Authorization: `Bearer ${token.trim()}` },
          }
        );
        if (!res.ok) {
          setFetchError("Could not load reports for that period.");
          return;
        }
        const next = (await res.json()) as ReportsPayload;
        setData(next);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `${pathname}?days=${nextDays}`);
        }
      } finally {
        setLoading(false);
      }
    },
    [clubId, pathname, token]
  );

  const maxBookings = Math.max(
    1,
    ...data.series.map((s) => s.bookings),
    data.totals.bookings
  );

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
              className="rounded-lg border border-stone bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm"
              value={data.days}
              disabled={loading}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) void onPeriodChange(n);
              }}
            >
              {!isPresetPeriod(data.days) && (
                <option value={data.days}>{data.days} days</option>
              )}
              {PERIOD_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
        </div>

        {fetchError && (
          <p className="text-sm text-amber-800" role="alert">
            {fetchError}
          </p>
        )}

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
          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm border-t-2 border-t-ds-gold">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Revenue ({data.days}d)
            </p>
            <p className="mt-2 font-display text-3xl text-ink">
              {usd.format(totalRevenueDisplay)}
            </p>
          </div>
          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm border-t-2 border-t-fairway/80">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Occupancy %
            </p>
            <p className="mt-2 font-display text-3xl text-ink tabular-nums">
              {data.totals.occupancyPct}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-stone bg-cream/50 px-4 py-3 text-sm text-ink">
            <span className="text-muted">Online bookings:</span>{" "}
            <span className="font-semibold tabular-nums">
              {data.totals.sources.online}
            </span>
          </div>
          <div className="rounded-lg border border-stone bg-cream/50 px-4 py-3 text-sm text-ink">
            <span className="text-muted">Staff entries:</span>{" "}
            <span className="font-semibold tabular-nums">
              {data.totals.sources.staff}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-xl border border-stone bg-white shadow-sm">
          <div className="border-b border-stone px-4 py-3">
            <h3 className="font-display text-lg text-ink">Daily breakdown</h3>
          </div>
          {data.series.every((s) => s.bookings === 0) ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No bookings in this period yet. When guests book online or staff add
              bookings, they will appear here.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_88px_1fr] border-b border-stone bg-cream/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted sm:grid-cols-[minmax(0,1fr)_80px_80px_96px_1fr]">
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
                    className="grid grid-cols-[minmax(0,1fr)_72px_72px_88px_1fr] items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_80px_80px_96px_1fr]"
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
            </>
          )}
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
