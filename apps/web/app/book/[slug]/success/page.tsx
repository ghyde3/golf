"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

const DownloadCalendarButton = dynamic(
  () =>
    import("@/components/booking/DownloadCalendarButton").then(
      (m) => m.DownloadCalendarButton
    ),
  { ssr: false }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ClubProfile {
  name: string;
  slug: string;
  config: {
    timezone: string;
  };
}

function SuccessContent({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const [club, setClub] = useState<ClubProfile | null>(null);

  const bookingRef = searchParams.get("bookingRef") || "";
  const datetime = searchParams.get("datetime") || "";
  const players = searchParams.get("players") || "1";
  const guestName = searchParams.get("guestName") || "";
  const guestEmail = searchParams.get("guestEmail") || "";
  const amountPaid = searchParams.get("amountPaid") || "";

  useEffect(() => {
    fetch(`${API_URL}/api/clubs/public/${params.slug}`)
      .then((r) => r.json())
      .then(setClub)
      .catch(console.error);
  }, [params.slug]);

  const timezone = club?.config?.timezone || "America/New_York";

  const formattedDate = datetime
    ? new Date(datetime).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
      })
    : "";

  const formattedTime = datetime
    ? new Date(datetime).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      })
    : "";

  return (
    <div className="flex min-h-screen flex-col items-center bg-ds-warm-white px-6 pb-10 pt-12">
      <div
        className="relative mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ds-fairway text-white after:absolute after:-inset-1.5 after:rounded-full after:border-[1.5px] after:border-ds-fairway/20"
        aria-hidden
      >
        <svg className="relative z-[1] h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="font-display text-[26px] text-ds-ink">You&apos;re booked!</h1>
      <p className="mt-2 max-w-[260px] text-center text-[13px] leading-relaxed text-ds-muted">
        Confirmation sent to <span className="font-medium text-ds-ink">{guestEmail}</span>. We&apos;ll remind you 24
        hours before.
      </p>

      <div className="mt-7 w-full max-w-md overflow-hidden rounded-2xl border-[1.5px] border-ds-stone bg-white shadow-card">
        <div className="relative overflow-hidden bg-ds-forest px-[18px] py-4 text-white">
          <div
            className="pointer-events-none absolute -bottom-8 -right-5 h-[120px] w-[120px] rounded-full border border-ds-grass/30"
            aria-hidden
          />
          <p className="relative font-display text-base">{club?.name ?? params.slug}</p>
          <p className="relative mt-1 text-xs text-white/60">
            {formattedDate} · {formattedTime}
          </p>
        </div>

        <div className="flex items-center bg-ds-cream">
          <div className="-ml-2.5 h-5 w-5 shrink-0 rounded-full border-[1.5px] border-ds-stone bg-ds-warm-white" aria-hidden />
          <div className="mx-1 h-0 flex-1 border-t-[1.5px] border-dashed border-ds-stone" />
          <div className="-mr-2.5 h-5 w-5 shrink-0 rounded-full border-[1.5px] border-ds-stone bg-ds-warm-white" aria-hidden />
        </div>

        <div className="space-y-3 px-[18px] py-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Date</p>
              <p className="text-sm font-semibold text-ds-ink">{formattedDate}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Time</p>
              <p className="text-sm font-semibold text-ds-ink">{formattedTime}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Players</p>
              <p className="text-sm font-semibold text-ds-ink">{players}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Name</p>
              <p className="text-sm font-semibold text-ds-ink">{guestName}</p>
            </div>
          </div>

          <div className="border-t border-ds-stone pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Booking reference</p>
            <p className="font-mono text-xl font-bold tracking-wider text-ds-fairway">{bookingRef}</p>
          </div>
          {amountPaid && (
            <div className="border-t border-ds-stone pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Amount charged</p>
              <p className="text-sm font-semibold text-ds-fairway">${parseFloat(amountPaid).toFixed(2)}</p>
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/book/${params.slug}`}
        className="relative mt-6 w-full max-w-md overflow-hidden rounded-[14px] bg-ds-fairway py-3.5 text-center text-[15px] font-semibold text-white after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/10 after:to-transparent after:pointer-events-none"
      >
        <span className="relative z-[1]">Book another tee time</span>
      </Link>

      {datetime && (
        <div className="mt-4 flex justify-center">
          <DownloadCalendarButton
            bookingRef={bookingRef}
            clubName={club?.name ?? params.slug}
            courseName=""
            datetimeIso={datetime}
            timezone={timezone}
            playersCount={Number(players)}
          />
        </div>
      )}

      {sessionStatus === "authenticated" && session && (
        <Link
          href="/my-bookings"
          className="mt-4 block w-full max-w-md text-center text-[15px] font-semibold text-ds-fairway underline-offset-4 hover:underline"
        >
          View my bookings →
        </Link>
      )}
      {sessionStatus === "unauthenticated" && (
        <Link
          href="/register"
          className="mt-4 block w-full max-w-md text-center text-[15px] font-semibold text-ds-fairway underline-offset-4 hover:underline"
        >
          Create an account to manage your bookings →
        </Link>
      )}
    </div>
  );
}

export default function SuccessPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ds-warm-white text-ds-muted">
          Loading…
        </div>
      }
    >
      <SuccessContent params={params} />
    </Suspense>
  );
}
