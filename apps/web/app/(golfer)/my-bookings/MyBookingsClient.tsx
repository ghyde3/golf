"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { ScorecardEntryModal } from "@/components/golfer/ScorecardEntryModal";
import { Button } from "@/components/ui/button";
import type { MeBookingsResponse, ScorecardItem } from "./page";

const DownloadCalendarButton = dynamic(
  () =>
    import("@/components/booking/DownloadCalendarButton").then(
      (m) => m.DownloadCalendarButton
    ),
  { ssr: false }
);

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

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function PaymentBadge({ paymentStatus }: { paymentStatus: string }) {
  const s = paymentStatus.toLowerCase();
  if (s === "paid") {
    return (
      <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
        Paid
      </span>
    );
  }
  if (s === "pending_payment") {
    return (
      <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
        Pending payment
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span className="inline-flex rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
        Payment failed
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md bg-stone-50 px-2 py-0.5 text-xs font-medium text-stone-600">
      Unpaid
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
  scorecard,
  onScorecardSaved,
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
  scorecard?: ScorecardItem;
  onScorecardSaved: () => void;
}) {
  const tz = booking.teeSlot.timezone || "America/New_York";
  const { dateLabel, timeLabel } = formatSlot(booking.teeSlot.datetime, tz);
  const paymentStatus = booking.paymentStatus ?? "unpaid";
  const totalCents = booking.totalCents ?? 0;
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
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ds-muted">
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
            Payment
          </span>
          <PaymentBadge paymentStatus={paymentStatus} />
        </span>
        {totalCents > 0 ? (
          <span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
              Total
            </span>{" "}
            <span className="font-medium text-ds-ink">{formatUsd(totalCents)}</span>
          </span>
        ) : (
          <span className="text-[12px] text-ds-muted">No charge</span>
        )}
      </div>
      <div className="mt-3">
        <DownloadCalendarButton
          bookingRef={booking.bookingRef}
          clubName={booking.teeSlot.clubName}
          courseName={booking.teeSlot.courseName}
          datetimeIso={booking.teeSlot.datetime}
          timezone={booking.teeSlot.timezone || "America/New_York"}
          playersCount={booking.playersCount}
        />
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
      {section === "past" && booking.teeSlot.courseId ? (
        <div className="mt-4">
          <ScorecardEntryModal
            booking={{
              id: booking.id,
              bookingRef: booking.bookingRef,
              teeSlot: {
                datetime: booking.teeSlot.datetime,
                courseName: booking.teeSlot.courseName,
                clubName: booking.teeSlot.clubName,
                clubId: booking.teeSlot.clubId,
                courseId: booking.teeSlot.courseId,
              },
              holes: booking.teeSlot.holes,
            }}
            accessToken={authToken ?? ""}
            existingScorecard={
              scorecard ? { holes: scorecard.holes } : null
            }
            onSaved={onScorecardSaved}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-ds-stone"
              >
                {scorecard ? "Edit score" : "Log score"}
              </Button>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

export default function MyBookingsClient({
  initialData,
  initialScorecards,
  accessToken,
}: {
  initialData: MeBookingsResponse;
  initialScorecards: ScorecardItem[];
  accessToken: string;
}) {
  const { data: session } = useSession();
  const authToken = session?.accessToken ?? accessToken;
  const [data, setData] = useState(initialData);
  const [scorecards, setScorecards] = useState(initialScorecards);
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

  const refetchScorecards = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/me/scorecards`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return;
    const next = (await res.json()) as ScorecardItem[];
    setScorecards(next);
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
                onScorecardSaved={() => void refetchScorecards()}
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
            data.past.map((b) => {
              const sc = scorecards.find(
                (s) => s.booking?.bookingRef === b.bookingRef
              );
              return (
                <BookingCard
                  key={b.id}
                  booking={b}
                  section="past"
                  authToken={authToken}
                  onCancelError={setCancelErr}
                  onCancelled={() => void refetch()}
                  scorecard={sc}
                  onScorecardSaved={() => void refetchScorecards()}
                />
              );
            })
          )}
        </div>
      </section>

      <div className="mt-10 flex flex-col gap-1">
        <Link
          href="/"
          className="inline-block text-sm font-medium text-ds-fairway underline-offset-4 hover:underline"
        >
          ← Back to home
        </Link>
        <Link
          href="/account"
          className="mt-4 inline-block text-sm font-medium text-ds-fairway underline-offset-4 hover:underline"
        >
          Account settings →
        </Link>
      </div>
    </div>
  );
}
