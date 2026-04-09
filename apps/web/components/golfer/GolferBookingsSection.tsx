"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ModifyBookingModal } from "@/components/golfer/ModifyBookingModal";
import { ScorecardEntryModal } from "@/components/golfer/ScorecardEntryModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MeBookingsResponse, ScorecardItem } from "@/lib/golfer-types";

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
      <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
      Confirmed
    </span>
  );
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function paymentLine(
  paymentStatus: string,
  totalCents: number
): { text: string; paidClass: boolean } {
  const s = paymentStatus.toLowerCase();
  if (s === "paid") return { text: "Paid", paidClass: true };
  if (s === "pending_payment") return { text: "Pending payment", paidClass: false };
  if (s === "failed") return { text: "Payment failed", paidClass: false };
  if (totalCents <= 0) return { text: "Unpaid · No charge", paidClass: false };
  return { text: "Unpaid", paidClass: false };
}

function PaginationBar({
  page,
  total,
  limit,
  upPage,
  pastPage,
  variant,
}: {
  page: number;
  total: number;
  limit: number;
  upPage: number;
  pastPage: number;
  variant: "upcoming" | "past";
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const href = (p: number) =>
    variant === "upcoming"
      ? `/account?upPage=${p}&pastPage=${pastPage}`
      : `/account?upPage=${upPage}&pastPage=${p}`;

  if (total <= limit) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ds-stone pt-3 text-[13px] text-ds-muted">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={href(prevPage)}
          scroll={false}
          className={
            canPrev
              ? "font-semibold text-ds-fairway underline-offset-4 hover:underline"
              : "pointer-events-none opacity-40"
          }
          aria-disabled={!canPrev}
        >
          Previous
        </Link>
        <span className="tabular-nums text-ds-ink">
          Page {page} of {totalPages}
        </span>
        <Link
          href={href(nextPage)}
          scroll={false}
          className={
            canNext
              ? "font-semibold text-ds-fairway underline-offset-4 hover:underline"
              : "pointer-events-none opacity-40"
          }
          aria-disabled={!canNext}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  showDot,
}: {
  children: React.ReactNode;
  showDot?: boolean;
}) {
  return (
    <h2 className="mb-3 mt-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ds-gold">
      {showDot ? (
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-ds-grass"
          aria-hidden
        />
      ) : null}
      {children}
    </h2>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[100px] flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ds-muted">
        {label}
      </span>
      <div className="text-[13px] font-medium text-ds-ink">{children}</div>
    </div>
  );
}

function BookingCard({
  booking,
  section,
  authToken,
  onCancelled,
  onModified,
  cancelError,
  onCancelError,
  scorecard,
  onScorecardSaved,
}: {
  booking: MeBookingsResponse["upcoming"][0];
  section: "upcoming" | "past";
  authToken: string | undefined;
  onCancelled: () => void;
  onModified: () => void;
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
  const pay = paymentLine(paymentStatus, totalCents);
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
          "Cancellation window has passed — please contact the club directly.",
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

  const showCancellationStrip =
    showCancelRow &&
    (!booking.isCancellable || cancelError?.outsideWindow === true);

  const cancellationStripText =
    cancelError?.message ??
    "Cancellation window has passed — please contact the club directly.";

  const inlineCancelErr =
    showCancelRow &&
    cancelError &&
    cancelError.outsideWindow !== true &&
    cancelError.message;

  return (
    <div
      className={cn(
        "mb-2.5 overflow-hidden rounded-[14px] border border-ds-stone bg-ds-warm-white shadow-sm",
        "transition-[box-shadow,transform,border-color] hover:-translate-y-px hover:border-stone-400 hover:shadow-[0_4px_18px_rgba(0,0,0,0.08)]"
      )}
    >
      <div className="px-5 py-[18px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-[17px] leading-snug text-ds-forest">
              {dateLabel}
              <span className="text-ds-muted"> · </span>
              {timeLabel}
            </p>
            <p className="mt-0.5 text-[13px] font-light text-ds-muted">
              {booking.teeSlot.courseName}
              <span className="text-ds-stone"> · </span>
              {booking.teeSlot.clubName}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
          <MetaItem label="Players">{booking.playersCount}</MetaItem>
          <MetaItem label="Reference">
            <span className="font-mono text-[12px] text-ds-muted">
              {booking.bookingRef}
            </span>
          </MetaItem>
          <MetaItem label="Payment">
            <span
              className={cn(
                pay.paidClass ? "font-medium text-green-700" : "text-ds-ink"
              )}
            >
              {pay.text}
            </span>
          </MetaItem>
          {totalCents > 0 ? (
            <MetaItem label="Total">{formatUsd(totalCents)}</MetaItem>
          ) : null}
        </div>

        <div className="my-3.5 h-px bg-ds-stone" />

        <div className="flex flex-wrap items-center gap-2">
          <DownloadCalendarButton
            bookingRef={booking.bookingRef}
            clubName={booking.teeSlot.clubName}
            courseName={booking.teeSlot.courseName}
            datetimeIso={booking.teeSlot.datetime}
            timezone={booking.teeSlot.timezone || "America/New_York"}
            playersCount={booking.playersCount}
            leadingPlus
          />
          {showCancelRow ? (
            <>
              {booking.isCancellable ? (
                <ModifyBookingModal
                  booking={{
                    id: booking.id,
                    bookingRef: booking.bookingRef,
                    playersCount: booking.playersCount,
                    teeSlot: {
                      datetime: booking.teeSlot.datetime,
                      courseName: booking.teeSlot.courseName,
                      clubName: booking.teeSlot.clubName,
                    },
                  }}
                  accessToken={authToken ?? ""}
                  onModified={onModified}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-ds-stone bg-ds-warm-white text-xs font-semibold text-ds-ink hover:bg-ds-cream"
                    >
                      Modify
                    </Button>
                  }
                />
              ) : null}
              {inlineCancelErr ? (
                <p className="w-full text-sm text-red-700" role="alert">
                  {inlineCancelErr}
                </p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs font-semibold text-ds-muted hover:bg-transparent hover:text-ds-ink"
                disabled={
                  !booking.isCancellable || busy || cancelError?.outsideWindow === true
                }
                onClick={() => void handleCancel()}
              >
                {busy ? "Cancelling…" : "Cancel booking"}
              </Button>
            </>
          ) : null}
          {section === "past" && booking.teeSlot.courseId ? (
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
              existingScorecard={scorecard ? { holes: scorecard.holes } : null}
              onSaved={onScorecardSaved}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-ds-stone bg-ds-warm-white text-xs font-semibold text-ds-ink hover:bg-ds-cream"
                >
                  {scorecard ? "Edit score" : "Log score"}
                </Button>
              }
            />
          ) : null}
        </div>
      </div>
      {showCancellationStrip ? (
        <div className="flex items-center gap-1.5 border-t border-amber-200/80 bg-amber-50/95 px-5 py-2.5 text-xs text-amber-900">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ds-gold" aria-hidden />
          {cancellationStripText}
        </div>
      ) : null}
    </div>
  );
}

export default function GolferBookingsSection({
  upcoming,
  past,
  totalUpcoming,
  totalPast,
  upPage,
  pastPage,
  limit,
  accessToken,
  initialScorecards,
}: {
  upcoming: MeBookingsResponse["upcoming"];
  past: MeBookingsResponse["past"];
  totalUpcoming: number;
  totalPast: number;
  upPage: number;
  pastPage: number;
  limit: number;
  accessToken: string;
  initialScorecards: ScorecardItem[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const authToken = session?.accessToken ?? accessToken;
  const [scorecards, setScorecards] = useState(initialScorecards);
  const [cancelErrors, setCancelErrors] = useState<
    Record<string, { message: string; outsideWindow?: boolean }>
  >({});

  useEffect(() => {
    setScorecards(initialScorecards);
  }, [initialScorecards]);

  const refetchBookings = useCallback(() => {
    setCancelErrors({});
    router.refresh();
  }, [router]);

  const refetchScorecards = useCallback(() => {
    router.refresh();
  }, [router]);

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
    <div>
      <div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ds-muted">No upcoming bookings.</p>
        ) : (
          upcoming.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              section="upcoming"
              authToken={authToken}
              cancelError={cancelErrors[b.id]}
              onCancelError={setCancelErr}
              onCancelled={() => void refetchBookings()}
              onModified={() => void refetchBookings()}
              onScorecardSaved={() => void refetchScorecards()}
            />
          ))
        )}
        <PaginationBar
          page={upPage}
          total={totalUpcoming}
          limit={limit}
          upPage={upPage}
          pastPage={pastPage}
          variant="upcoming"
        />
      </div>

      <SectionLabel>Past rounds</SectionLabel>
      <div>
        {past.length === 0 ? (
          <p className="text-sm text-ds-muted">No past bookings.</p>
        ) : (
          past.map((b) => {
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
                onCancelled={() => void refetchBookings()}
                onModified={() => void refetchBookings()}
                scorecard={sc}
                onScorecardSaved={() => void refetchScorecards()}
              />
            );
          })
        )}
        <PaginationBar
          page={pastPage}
          total={totalPast}
          limit={limit}
          upPage={upPage}
          pastPage={pastPage}
          variant="past"
        />
      </div>
    </div>
  );
}
