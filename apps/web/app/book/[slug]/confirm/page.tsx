"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface ClubProfile {
  id: string;
  name: string;
  slug: string;
  bookingFee?: string | null;
  config: {
    timezone: string;
    cancellationHours: number;
  };
}

// The inner form — uses Stripe hooks, must be inside <Elements>
function ConfirmFormInner({ params, club }: { params: { slug: string }; club: ClubProfile | null }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const clubId = searchParams.get("clubId") || "";
  const courseId = searchParams.get("courseId") || "";
  const datetime = searchParams.get("datetime") || "";
  const playersParam = searchParams.get("players") || "2";
  const slotId = searchParams.get("slotId") || "";
  const slotType = searchParams.get("slotType") || "18hole";
  const priceStr = searchParams.get("price") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const players = Number(playersParam);

  const timezone = club?.config?.timezone || "America/New_York";
  const bookingFee = parseFloat(club?.bookingFee ?? "0");
  const totalFee = bookingFee * players;
  const requiresPayment = totalFee > 0 && stripePromise !== null;

  const formattedDate = datetime
    ? new Date(datetime).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", timeZone: timezone,
      })
    : "";

  const formattedTime = datetime
    ? new Date(datetime).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: timezone,
      })
    : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      if (requiresPayment) {
        // Step 1: Create PaymentIntent + reserve slot
        const piBody: Record<string, unknown> = {
          playersCount: players,
          guestName: name,
          guestEmail: email,
          notes: notes || undefined,
          clubSlug: params.slug,
        };
        if (slotId) {
          piBody.teeSlotId = slotId;
        } else {
          piBody.courseId = courseId;
          piBody.datetime = datetime;
        }

        const piRes = await fetch(`${API_URL}/api/bookings/public/payment-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(piBody),
        });

        if (piRes.status === 409) {
          router.push(`/book/${params.slug}/times?clubId=${clubId}&error=slot_full`);
          return;
        }
        if (!piRes.ok) {
          const data = await piRes.json();
          setError(data.error || "Something went wrong");
          setSubmitting(false);
          return;
        }

        const piData = await piRes.json();

        if (!piData.requiresPayment) {
          // Club switched to free — fall through to direct booking (shouldn't happen in practice)
          // Just do direct booking
        } else {
          // Step 2: Confirm card payment in-browser
          if (!stripe || !elements) {
            setError("Payment system not loaded. Please refresh.");
            setSubmitting(false);
            return;
          }
          const cardElement = elements.getElement(CardElement);
          if (!cardElement) {
            setError("Card input not found.");
            setSubmitting(false);
            return;
          }

          const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
            piData.clientSecret,
            {
              payment_method: {
                card: cardElement,
                billing_details: { name, email },
              },
            }
          );

          if (stripeError) {
            setError(stripeError.message || "Payment failed. Please try again.");
            setSubmitting(false);
            return;
          }

          if (!paymentIntent || paymentIntent.status !== "succeeded") {
            setError("Payment was not completed. Please try again.");
            setSubmitting(false);
            return;
          }

          // Step 3: Confirm payment server-side
          const confirmRes = await fetch(`${API_URL}/api/bookings/public/confirm-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookingId: piData.bookingId,
              paymentIntentId: paymentIntent.id,
            }),
          });

          if (!confirmRes.ok) {
            setError("Payment confirmed but booking failed. Please contact support.");
            setSubmitting(false);
            return;
          }

          const confirmed = await confirmRes.json();
          const q = new URLSearchParams({
            bookingRef: confirmed.bookingRef ?? piData.bookingRef,
            datetime: confirmed.datetime ?? piData.datetime,
            players: String(players),
            guestName: name,
            guestEmail: email,
            amountPaid: (totalFee).toFixed(2),
          });
          router.push(`/book/${params.slug}/success?${q.toString()}`);
          return;
        }
      }

      // Zero-fee path (unchanged from original)
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

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "14px",
        color: "#1a2e1a",
        fontFamily: "inherit",
        "::placeholder": { color: "#9ca3af" },
      },
      invalid: { color: "#dc2626" },
    },
    hidePostalCode: false,
  };

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
          <div className="pointer-events-none absolute -right-5 -top-8 h-40 w-40 rounded-full border border-ds-grass/30" aria-hidden />
          <div className="pointer-events-none absolute right-5 top-0 h-20 w-20 rounded-full border border-ds-gold/20" aria-hidden />
          <p className="relative font-display text-[17px]">{club?.name ?? "Loading..."}</p>
          <p className="relative mt-1.5 text-[13px] leading-relaxed text-white/65">
            {players} player{players !== 1 ? "s" : ""} · {formattedDate} · {formattedTime}
            {priceStr ? ` · $${priceStr}/player` : ""}
          </p>
          {totalFee > 0 && (
            <p className="relative mt-1.5 text-[13px] text-white/65">
              Booking fee: <span className="font-semibold text-white">${totalFee.toFixed(2)}</span>
            </p>
          )}
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

          {requiresPayment && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
                Payment
              </label>
              <div className="w-full rounded-[10px] border-[1.5px] border-ds-stone bg-white px-3.5 py-3">
                <CardElement options={cardElementOptions} />
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ds-muted">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Secured by Stripe
              </p>
            </div>
          )}

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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {requiresPayment ? "Processing payment..." : "Reserving..."}
              </span>
            ) : (
              <span className="relative z-[1]">{requiresPayment ? `Pay $${totalFee.toFixed(2)} & Reserve` : "Reserve tee time"}</span>
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

// Wrapper that fetches club data and provides Stripe Elements context
function ConfirmForm({ params }: { params: { slug: string } }) {
  const [club, setClub] = useState<ClubProfile | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/clubs/public/${params.slug}`)
      .then((r) => r.json())
      .then(setClub)
      .catch(console.error);
  }, [params.slug]);

  if (stripePromise) {
    return (
      <Elements stripe={stripePromise}>
        <ConfirmFormInner params={params} club={club} />
      </Elements>
    );
  }

  // Stripe not configured — render without Elements (zero-fee clubs only)
  return <ConfirmFormInner params={params} club={club} />;
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
