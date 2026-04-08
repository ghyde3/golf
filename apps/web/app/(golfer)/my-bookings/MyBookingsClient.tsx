"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import type { MeBookingsResponse } from "./page";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function formatSlot(
  iso: string,
  timezone: string
): { dateLabel: string; timeLabel: string } {
  const d = new Date(iso);
  const dateLabel = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  });
  const timeLabel = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  return { dateLabel, timeLabel };
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "cancelled") {
    return (
      <span className="inline-flex rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
      Confirmed
    </span>
  );
}

function BookingCard({
  booking,
  section,
  authToken,
  onCancelled,
  cancelError,
  onCancelError,
}: {
  booking: MeBookingsResponse["upcoming"][0];
  section: "upcoming" | "past";
  authToken: string | undefined;
  onCancelled: () => void;
  cancelError?: { message: string; outsideWindow?: boolean };
  onCancelError: (
    bookingId: string,
    message: string | null,
    options?: { outsideWindow?: boolean }
  ) => void;
}) {
  const tz = booking.teeSlot.timezone || "America/New_York";
  const { dateLabel, timeLabel } = formatSlot(booking.teeSlot.datetime, tz);
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    const token = authToken?.trim();
    if (!token) {
      onCancelError(booking.id, "Sign in to cancel this booking.");
      return;
    }
    setBusy(true);
    onCancelError(booking.id, null);
    try {
      const delRes = await fetch(`${API_URL}/api/bookings/${booking.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await delRes.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
      };
      if (delRes.status === 403 && body.code === "OUTSIDE_WINDOW") {
        onCancelError(
          booking.id,
          "Cancellation window has passed — please contact the club.",
          { outsideWindow: true }
        );
        return;
      }
      if (!delRes.ok) {
        onCancelError(booking.id, body.error ?? "Could not cancel booking.");
        return;
      }
      onCancelled();
    } finally {
      setBusy(false);
    }
  }

  const showCancelRow =
    section === "upcoming" && booking.status !== "cancelled";

  const inlineCancelMsg =
    cancelError?.message ??
    (!booking.isCancellable
      ? "Cancellation window has passed — please contact the club."
      : null);

  const cancelBlockedByApi = cancelError?.outsideWindow === true;

  return (
    <div className="rounded-2xl border-[1.5px] border-ds-stone bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg text-ds-ink">
            {dateLabel}
            <span className="text-ds-muted"> · </span>
            {timeLabel}
          </p>
          <p className="mt-1 text-sm text-ds-ink">
            {booking.teeSlot.courseName}
            <span className="text-ds-muted"> · </span>
            {booking.teeSlot.clubName}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ds-muted">
        <span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
            Players
          </span>{" "}
          <span className="text-ds-ink">{booking.playersCount}</span>
        </span>
        <span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
            Reference
          </span>{" "}
          <span className="font-mono text-ds-ink">{booking.bookingRef}</span>
        </span>
      </div>
      {showCancelRow && (
        <div className="mt-4">
          {inlineCancelMsg && (
            <p className="mb-2 text-sm text-amber-800">{inlineCancelMsg}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-ds-stone"
            disabled={
              !booking.isCancellable || busy || cancelBlockedByApi
            }
            onClick={() => void handleCancel()}
          >
            {busy ? "Cancelling…" : "Cancel"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function MyBookingsClient({
  initialData,
  accessToken,
}: {
  initialData: MeBookingsResponse;
  accessToken: string;
}) {
  const { data: session } = useSession();
  const authToken = session?.accessToken ?? accessToken;
  const [data, setData] = useState(initialData);
  const [cancelErrors, setCancelErrors] = useState<
    Record<string, { message: string; outsideWindow?: boolean }>
  >({});

  const refetch = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/me/bookings`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return;
    const next = (await res.json()) as MeBookingsResponse;
    setData(next);
  }, [authToken]);

  const setCancelErr = useCallback(
    (
      id: string,
      message: string | null,
      options?: { outsideWindow?: boolean }
    ) => {
      setCancelErrors((prev) => {
        const next = { ...prev };
        if (message === null) delete next[id];
        else next[id] = { message, outsideWindow: options?.outsideWindow };
        return next;
      });
    },
    []
  );

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
        Golfer
      </p>
      <h1 className="mt-1 font-display text-[28px] text-ds-forest">
        My bookings
      </h1>
      <p className="mt-2 text-sm text-ds-muted">
        Upcoming tee times and your history.
      </p>

      <section className="mt-10">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
          Upcoming
        </h2>
        <div className="mt-3 space-y-3">
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-ds-muted">No upcoming bookings.</p>
          ) : (
            data.upcoming.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                section="upcoming"
                authToken={authToken}
                cancelError={cancelErrors[b.id]}
                onCancelError={setCancelErr}
                onCancelled={() => void refetch()}
              />
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
          Past
        </h2>
        <div className="mt-3 space-y-3">
          {data.past.length === 0 ? (
            <p className="text-sm text-ds-muted">No past bookings.</p>
          ) : (
            data.past.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                section="past"
                authToken={authToken}
                onCancelError={setCancelErr}
                onCancelled={() => void refetch()}
              />
            ))
          )}
        </div>
      </section>

      <Link
        href="/"
        className="mt-10 inline-block text-sm font-medium text-ds-fairway underline-offset-4 hover:underline"
      >
        ← Back to home
      </Link>
    </div>
  );
}
