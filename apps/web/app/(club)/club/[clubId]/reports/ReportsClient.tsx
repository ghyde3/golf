"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";
import Link from "next/link";

export type ReportsPayload = {
  days: number;
  series: { date: string; bookings: number; players: number }[];
  totals: {
    bookings: number;
    players: number;
    sources: { online: number; staff: number };
  };
};

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
  data,
}: {
  clubId: string;
  data: ReportsPayload;
}) {
  const maxBookings = Math.max(
    1,
    ...data.series.map((s) => s.bookings),
    data.totals.bookings
  );

  return (
    <>
      <SetTopBar title="Reports" />
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
        <div>
          <p className="max-w-2xl text-sm text-muted">
            Booking activity for the last {data.days} days (UTC), matching how
            dashboard counts are computed.
          </p>
        </div>

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
              <div className="grid grid-cols-[minmax(0,1fr)_80px_80px_1fr] border-b border-stone bg-cream/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                <span>Date</span>
                <span className="text-right">Bookings</span>
                <span className="text-right">Players</span>
                <span />
              </div>
              <div className="divide-y divide-stone">
                {data.series.map((s) => (
                  <div
                    key={s.date}
                    className="grid grid-cols-[minmax(0,1fr)_80px_80px_1fr] items-center gap-2 px-4 py-3"
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
