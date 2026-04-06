"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ClubProfile {
  id: string;
  name: string;
  slug: string;
  config: {
    timezone: string;
    cancellationHours: number;
  };
}

function ConfirmForm({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const clubId = searchParams.get("clubId") || "";
  const courseId = searchParams.get("courseId") || "";
  const datetime = searchParams.get("datetime") || "";
  const playersParam = searchParams.get("players") || "2";
  const slotId = searchParams.get("slotId") || "";
  const slotType = searchParams.get("slotType") || "18hole";
  const priceStr = searchParams.get("price") || "";

  const [club, setClub] = useState<ClubProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const players = Number(playersParam);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        playersCount: players,
        guestName: name,
        guestEmail: email,
        notes: notes || undefined,
        clubSlug: params.slug,
      };

      if (slotId) {
        body.teeSlotId = slotId;
      } else {
        body.courseId = courseId;
        body.datetime = datetime;
      }

      const res = await fetch(`${API_URL}/api/bookings/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        router.push(`/book/${params.slug}/times?clubId=${clubId}&error=slot_full`);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setSubmitting(false);
        return;
      }

      const booking = await res.json();
      const q = new URLSearchParams({
        bookingRef: booking.bookingRef,
        datetime: booking.datetime,
        players: String(players),
        guestName: name,
        guestEmail: email,
      });
      router.push(`/book/${params.slug}/success?${q.toString()}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ds-warm-white pb-10">
      <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center gap-3 border-b border-ds-stone bg-ds-warm-white px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[13px] font-medium text-ds-fairway"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>
        <h1 className="font-display text-base text-ds-ink">Confirm booking</h1>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-5">
        <div className="relative mb-4 overflow-hidden rounded-2xl bg-ds-forest p-[18px] text-white shadow-card">
          <div
            className="pointer-events-none absolute -right-5 -top-8 h-40 w-40 rounded-full border border-ds-grass/30"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute right-5 top-0 h-20 w-20 rounded-full border border-ds-gold/20"
            aria-hidden
          />
          <p className="relative font-display text-[17px]">{club?.name ?? "Loading..."}</p>
          <p className="relative mt-1.5 text-[13px] leading-relaxed text-white/65">
            {players} player{players !== 1 ? "s" : ""} · {formattedDate} · {formattedTime}
            {priceStr ? ` · $${priceStr}/player` : ""}
          </p>
          <p className="relative mt-3 inline-flex items-center gap-1 rounded-full border border-ds-gold/35 bg-ds-gold/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ds-gold-light">
            {slotType.replace("hole", " holes")}
          </p>
        </div>

        <div className="mb-5 flex gap-2.5 rounded-[10px] border border-ds-stone bg-ds-cream px-3.5 py-3 text-xs leading-relaxed text-ds-muted">
          <span className="mt-0.5 shrink-0 text-ds-grass" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </span>
          <p>
            <span className="font-semibold text-ds-ink">Free cancellation</span> up to{" "}
            {club?.config?.cancellationHours ?? 24} hours before your tee time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
              Name *
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-[10px] border-[1.5px] border-ds-stone bg-white px-3.5 py-3 text-sm text-ds-ink outline-none focus:border-ds-grass"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
              Email *
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-[10px] border-[1.5px] border-ds-stone bg-white px-3.5 py-3 text-sm text-ds-ink outline-none focus:border-ds-grass"
            />
          </div>

          <div>
            <label htmlFor="notes" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
              Special requests <span className="font-normal normal-case text-ds-muted/80">(optional)</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Left-handed clubs, wheelchair accessible cart, etc."
              rows={3}
              className="h-20 w-full resize-none rounded-[10px] border-[1.5px] border-ds-stone bg-white px-3.5 py-3 text-sm text-ds-ink outline-none focus:border-ds-grass"
            />
            <p className="mt-1 text-right text-[11px] text-ds-muted">{notes.length}/500</p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !name || !email}
            className={`relative w-full overflow-hidden rounded-[14px] py-4 text-[15px] font-semibold transition-colors after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/10 after:to-transparent after:pointer-events-none ${
              submitting || !name || !email
                ? "cursor-not-allowed bg-ds-stone text-ds-muted"
                : "bg-ds-fairway text-white"
            }`}
          >
            {submitting ? (
              <span className="relative z-[1] flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Reserving...
              </span>
            ) : (
              <span className="relative z-[1]">Reserve tee time</span>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 w-full text-center text-[13px] text-ds-muted underline decoration-transparent hover:decoration-ds-muted"
        >
          Back to tee times
        </button>
      </div>
    </div>
  );
}

export default function ConfirmPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ds-warm-white text-ds-muted">
          Loading…
        </div>
      }
    >
      <ConfirmForm params={params} />
    </Suspense>
  );
}
