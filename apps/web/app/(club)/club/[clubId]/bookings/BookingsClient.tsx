"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";
import Link from "next/link";

export type ClubBookingRow = {
  id: string;
  bookingRef: string;
  guestName: string | null;
  guestEmail: string | null;
  playersCount: number;
  status: string | null;
  createdAt: string;
  teeSlot: {
    datetime: string;
    courseId: string;
    courseName: string;
  };
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function BookingsClient({
  clubId,
  bookings,
}: {
  clubId: string;
  bookings: ClubBookingRow[];
}) {
  return (
    <>
      <SetTopBar title="Bookings" />
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
        <div>
          <p className="max-w-xl text-sm text-muted">
            Placed today (UTC) — matches the count in the sidebar.
          </p>
        </div>

        <div className="flex min-h-0 flex-col rounded-xl border border-stone bg-white shadow-sm">
          <div className="border-b border-stone px-4 py-3">
            <h3 className="font-display text-lg text-ink">Today</h3>
          </div>
          {bookings.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No bookings placed today.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_80px_100px] border-b border-stone bg-cream/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted sm:grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)_70px_90px]">
                <span className="hidden sm:block">Tee time</span>
                <span>Guest</span>
                <span className="hidden sm:block">Course</span>
                <span>Players</span>
                <span className="text-right">Ref</span>
              </div>
              <div className="divide-y divide-stone">
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)_70px_90px] sm:items-center sm:gap-0"
                  >
                    <div className="text-sm text-ink">
                      <span className="font-medium">
                        {formatTime(b.teeSlot.datetime)}
                      </span>
                      <span className="text-muted sm:hidden">
                        {" "}
                        · {formatDate(b.teeSlot.datetime)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">
                        {b.guestName?.trim() || "Guest"}
                      </div>
                      {b.guestEmail ? (
                        <div className="truncate text-xs text-muted">
                          {b.guestEmail}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-sm text-ink sm:truncate">
                      <span className="sm:hidden text-muted">Course: </span>
                      {b.teeSlot.courseName}
                    </div>
                    <div className="text-sm tabular-nums text-ink">
                      {b.playersCount}
                    </div>
                    <div className="text-right">
                      <Link
                        href={`/club/${clubId}/teesheet?date=${encodeURIComponent(
                          b.teeSlot.datetime.slice(0, 10)
                        )}`}
                        className="text-xs font-semibold text-fairway hover:underline"
                      >
                        {b.bookingRef}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
