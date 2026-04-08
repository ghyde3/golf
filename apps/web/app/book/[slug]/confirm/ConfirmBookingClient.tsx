"use client";

import {
  Suspense,
  useState,
  useEffect,
  type FormEvent,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function jsonHeaders(accessToken?: string | null): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken?.trim()) {
    h.Authorization = `Bearer ${accessToken.trim()}`;
  }
  return h;
}

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

type PublicAddonItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  sortOrder: number;
  unitsConsumed: number;
  resourceTypeId: string | null;
};

function maxAddonQuantity(a: PublicAddonItem): number {
  return a.unitsConsumed === 1 ? 4 : 1;
}

type WizardStep = "details" | "addons" | "payment";

const STEP_LABEL: Record<WizardStep, string> = {
  details: "Details",
  addons: "Add-ons",
  payment: "Payment",
};

function StepIndicator({
  steps,
  stepIdx,
}: {
  steps: WizardStep[];
  stepIdx: number;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-1">
        {steps.map((step, i) => {
          const isActive = i === stepIdx;
          const isDone = i < stepIdx;
          return (
            <div key={`${step}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                {i > 0 ? (
                  <div
                    className={`h-[2px] flex-1 rounded-full ${i <= stepIdx ? "bg-ds-grass/80" : "bg-ds-stone/60"}`}
                    aria-hidden
                  />
                ) : (
                  <div className="flex-1" aria-hidden />
                )}
                <div
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-colors ${
                    isDone
                      ? "bg-ds-grass text-white"
                      : isActive
                        ? "bg-ds-fairway text-white"
                        : "border-2 border-ds-stone bg-white text-ds-muted"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isDone ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                {i < steps.length - 1 ? (
                  <div
                    className={`h-[2px] flex-1 rounded-full ${i < stepIdx ? "bg-ds-grass/80" : "bg-ds-stone/60"}`}
                    aria-hidden
                  />
                ) : (
                  <div className="flex-1" aria-hidden />
                )}
              </div>
              <p
                className={`max-w-[5.5rem] text-center text-[10px] font-semibold uppercase tracking-[0.08em] ${
                  isActive ? "text-ds-fairway" : isDone ? "text-ds-grass" : "text-ds-muted"
                }`}
              >
                {STEP_LABEL[step]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepDetails({
  contactCompleteFromSession,
  isAuthed,
  sessionName,
  sessionEmail,
  name,
  setName,
  email,
  setEmail,
  notes,
  setNotes,
  onContinue,
  detailsValid,
}: {
  contactCompleteFromSession: boolean;
  isAuthed: boolean;
  sessionName: string;
  sessionEmail: string;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  onContinue: () => void;
  detailsValid: boolean;
}) {
  return (
    <div className="space-y-3.5">
      {contactCompleteFromSession ? (
        <div className="rounded-[10px] border border-ds-stone bg-white px-3.5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Your details</p>
          <p className="mt-1.5 text-sm font-medium text-ds-ink">{sessionName}</p>
          <p className="text-[13px] text-ds-muted">{sessionEmail}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-ds-muted">
            Signed in — we&apos;ll use this name and email for the booking.
          </p>
        </div>
      ) : isAuthed ? (
        <>
          <div className="rounded-[10px] border border-ds-stone bg-white px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Email</p>
            <p className="mt-1 text-sm text-ds-ink">{sessionEmail}</p>
          </div>
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ds-muted"
            >
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-[10px] border-[1.5px] border-ds-stone bg-white px-3.5 py-3 text-sm text-ds-ink outline-none focus:border-ds-grass"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ds-muted"
            >
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-[10px] border-[1.5px] border-ds-stone bg-white px-3.5 py-3 text-sm text-ds-ink outline-none focus:border-ds-grass"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ds-muted"
            >
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-[10px] border-[1.5px] border-ds-stone bg-white px-3.5 py-3 text-sm text-ds-ink outline-none focus:border-ds-grass"
            />
          </div>
        </>
      )}

      <div>
        <label
          htmlFor="notes"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ds-muted"
        >
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

      <button
        type="button"
        onClick={onContinue}
        disabled={!detailsValid}
        className={`relative w-full overflow-hidden rounded-[14px] py-4 text-[15px] font-semibold transition-colors after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/10 after:to-transparent after:pointer-events-none ${
          !detailsValid ? "cursor-not-allowed bg-ds-stone text-ds-muted" : "bg-ds-fairway text-white"
        }`}
      >
        <span className="relative z-[1]">Continue →</span>
      </button>
    </div>
  );
}

function StepAddOns({
  addonCatalog,
  addonQty,
  setAddonQty,
  addonSubtotalCents,
  onContinue,
}: {
  addonCatalog: PublicAddonItem[];
  addonQty: Record<string, number>;
  setAddonQty: Dispatch<SetStateAction<Record<string, number>>>;
  addonSubtotalCents: number;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-3.5">
      <div className="rounded-[10px] border border-ds-stone bg-white px-3.5 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Add-ons</p>
        <ul className="mt-3 space-y-3">
          {addonCatalog.map((a) => {
            const q = addonQty[a.id] ?? 0;
            const maxQ = maxAddonQuantity(a);
            return (
              <li
                key={a.id}
                className="flex flex-col gap-1 border-b border-ds-stone/70 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ds-ink">{a.name}</p>
                    {a.description ? <p className="mt-0.5 text-[12px] text-ds-muted">{a.description}</p> : null}
                    <p className="mt-1 text-[12px] text-ds-muted">${(a.priceCents / 100).toFixed(2)} each</p>
                  </div>
                  <div className="flex min-w-[100px] items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-ds-stone px-2.5 py-1 text-sm text-ds-ink disabled:opacity-40"
                      disabled={q <= 0}
                      onClick={() =>
                        setAddonQty((prev) => ({
                          ...prev,
                          [a.id]: Math.max(0, (prev[a.id] ?? 0) - 1),
                        }))
                      }
                      aria-label={`Decrease ${a.name}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">{q}</span>
                    <button
                      type="button"
                      className="rounded-lg border border-ds-stone px-2.5 py-1 text-sm text-ds-ink disabled:opacity-40"
                      disabled={q >= maxQ}
                      onClick={() =>
                        setAddonQty((prev) => ({
                          ...prev,
                          [a.id]: Math.min(maxQ, (prev[a.id] ?? 0) + 1),
                        }))
                      }
                      aria-label={`Increase ${a.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {addonSubtotalCents > 0 && (
          <p className="mt-3 text-right text-sm font-medium text-ds-ink">
            Add-ons subtotal: ${(addonSubtotalCents / 100).toFixed(2)}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="relative w-full overflow-hidden rounded-[14px] bg-ds-fairway py-4 text-[15px] font-semibold text-white transition-colors after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/10 after:to-transparent after:pointer-events-none"
      >
        <span className="relative z-[1]">Continue →</span>
      </button>
    </div>
  );
}

function StepPayment({
  players,
  bookingFee,
  totalFee,
  addonCatalog,
  addonQty,
  addonSubtotalCents,
  grandTotalDollars,
  requiresPayment,
  cardElementOptions,
  error,
  submitting,
  guestEmailForBooking,
  guestNameForBooking,
  childrenSubmitButton,
}: {
  players: number;
  bookingFee: number;
  totalFee: number;
  addonCatalog: PublicAddonItem[];
  addonQty: Record<string, number>;
  addonSubtotalCents: number;
  grandTotalDollars: number;
  requiresPayment: boolean;
  cardElementOptions: {
    style: {
      base: Record<string, string | Record<string, string>>;
      invalid: { color: string };
    };
    hidePostalCode: boolean;
  };
  error: string;
  submitting: boolean;
  guestEmailForBooking: string;
  guestNameForBooking: string;
  childrenSubmitButton: ReactNode;
}) {
  const addonLines = addonCatalog.filter((a) => (addonQty[a.id] ?? 0) > 0);

  return (
    <div className="space-y-3.5">
      <div className="rounded-[10px] border border-ds-stone bg-white px-3.5 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Order summary</p>
        <ul className="mt-3 space-y-2 text-sm text-ds-ink">
          {totalFee > 0 && (
            <li className="flex flex-wrap justify-between gap-2">
              <span className="text-ds-muted">
                Booking fee: ${bookingFee.toFixed(2)} × {players} player{players !== 1 ? "s" : ""}
              </span>
              <span className="shrink-0 font-medium tabular-nums">${totalFee.toFixed(2)}</span>
            </li>
          )}
          {addonLines.map((a) => {
            const q = addonQty[a.id] ?? 0;
            const sub = (q * a.priceCents) / 100;
            return (
              <li key={a.id} className="flex flex-wrap justify-between gap-2">
                <span className="text-ds-muted">
                  {a.name} × {q}
                </span>
                <span className="shrink-0 font-medium tabular-nums">${sub.toFixed(2)}</span>
              </li>
            );
          })}
          <li className="flex flex-wrap justify-between gap-2 border-t border-ds-stone/70 pt-2 text-[15px] font-semibold">
            <span>Total</span>
            <span className="shrink-0 tabular-nums">${grandTotalDollars.toFixed(2)}</span>
          </li>
        </ul>
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
        disabled={submitting || !guestEmailForBooking || !guestNameForBooking}
        className={`relative w-full overflow-hidden rounded-[14px] py-4 text-[15px] font-semibold transition-colors after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/10 after:to-transparent after:pointer-events-none ${
          submitting || !guestEmailForBooking || !guestNameForBooking
            ? "cursor-not-allowed bg-ds-stone text-ds-muted"
            : "bg-ds-fairway text-white"
        }`}
      >
        {childrenSubmitButton}
      </button>
    </div>
  );
}

// The inner form — uses Stripe hooks, must be inside <Elements>
function ConfirmFormInner({
  params,
  club,
  showGuestRegistrationBanner,
  sessionUser,
}: {
  params: { slug: string };
  club: ClubProfile | null;
  showGuestRegistrationBanner: boolean;
  sessionUser: { name: string | null; email: string | null } | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const { data: session, status: sessionStatus } = useSession();

  const accessToken = session?.accessToken;
  const sessionEmail =
    session?.user?.email?.trim() ?? sessionUser?.email?.trim() ?? "";
  const sessionName =
    session?.user?.name?.trim() ?? sessionUser?.name?.trim() ?? "";
  const isAuthed =
    (sessionStatus === "authenticated" && Boolean(sessionEmail)) ||
    Boolean(sessionUser?.email?.trim());
  /** Logged-in user with name + email from account — only notes / payment left */
  const contactCompleteFromSession = isAuthed && Boolean(sessionName) && Boolean(sessionEmail);

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
  const [addonCatalog, setAddonCatalog] = useState<PublicAddonItem[]>([]);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [addonCatalogLoaded, setAddonCatalogLoaded] = useState(false);
  const [steps, setSteps] = useState<WizardStep[]>(["details", "payment"]);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!isAuthed) return;
    if (sessionEmail) setEmail(sessionEmail);
    if (sessionName) setName(sessionName);
  }, [isAuthed, sessionEmail, sessionName]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/clubs/public/${params.slug}/addons`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PublicAddonItem[]) => {
        if (!cancelled && Array.isArray(data)) {
          setAddonCatalog(data);
          const init: Record<string, number> = {};
          for (const a of data) init[a.id] = 0;
          setAddonQty((prev) => ({ ...init, ...prev }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAddonCatalogLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [params.slug]);

  useEffect(() => {
    if (!addonCatalogLoaded) return;
    const nextSteps: WizardStep[] =
      addonCatalog.length > 0 ? ["details", "addons", "payment"] : ["details", "payment"];
    setSteps((prev) => {
      if (prev.length === 2 && nextSteps.length === 3) {
        setStepIdx((i) => (i === 1 ? 2 : i));
      }
      return nextSteps;
    });
  }, [addonCatalogLoaded, addonCatalog.length]);

  /** Values sent to the API / Stripe (session wins when signed in so we don't wait on useState sync). */
  const guestEmailForBooking = sessionEmail || email.trim();
  const guestNameForBooking = contactCompleteFromSession
    ? sessionName
    : sessionStatus === "authenticated"
      ? sessionName || name.trim()
      : name.trim();

  const players = Number(playersParam);

  const timezone = club?.config?.timezone || "America/New_York";
  const bookingFee = parseFloat(club?.bookingFee ?? "0");
  const totalFee = bookingFee * players;
  const addonSubtotalCents = addonCatalog.reduce((sum, a) => {
    const q = addonQty[a.id] ?? 0;
    return sum + q * a.priceCents;
  }, 0);
  const grandTotalDollars = totalFee + addonSubtotalCents / 100;
  const requiresPayment = grandTotalDollars > 0 && stripePromise !== null;

  function buildAddOnsPayload(): { addonCatalogId: string; quantity: number }[] {
    const out: { addonCatalogId: string; quantity: number }[] = [];
    for (const a of addonCatalog) {
      const q = addonQty[a.id] ?? 0;
      if (q > 0) out.push({ addonCatalogId: a.id, quantity: q });
    }
    return out;
  }

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

  const currentStep = steps[stepIdx] ?? "details";

  function detailsValid(): boolean {
    if (contactCompleteFromSession) return true;
    if (isAuthed) {
      return Boolean(sessionEmail?.trim() && name.trim());
    }
    return Boolean(name.trim() && email.trim());
  }

  function goBackOrExit() {
    if (stepIdx <= 0) {
      router.back();
    } else {
      setStepIdx((i) => Math.max(0, i - 1));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      if (requiresPayment) {
        // Step 1: Create PaymentIntent + reserve slot
        const piBody: Record<string, unknown> = {
          playersCount: players,
          guestName: guestNameForBooking,
          guestEmail: guestEmailForBooking,
          notes: notes || undefined,
          clubSlug: params.slug,
        };
        if (slotId) {
          piBody.teeSlotId = slotId;
        } else {
          piBody.courseId = courseId;
          piBody.datetime = datetime;
        }
        const addOnsPayload = buildAddOnsPayload();
        if (addOnsPayload.length > 0) {
          piBody.addOns = addOnsPayload;
        }

        const piRes = await fetch(`${API_URL}/api/bookings/public/payment-intent`, {
          method: "POST",
          headers: jsonHeaders(accessToken),
          body: JSON.stringify(piBody),
        });

        if (piRes.status === 409) {
          const data = await piRes.json().catch(() => ({}));
          if (data.code === "ADDON_UNAVAILABLE") {
            setError(
              typeof data.name === "string"
                ? `${data.name} is not available.`
                : "An add-on is not available."
            );
            setSubmitting(false);
            return;
          }
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
          const q = new URLSearchParams({
            bookingRef: String(piData.bookingRef ?? ""),
            datetime: String(piData.datetime ?? ""),
            players: String(players),
            guestName: guestNameForBooking,
            guestEmail: guestEmailForBooking,
            amountPaid: grandTotalDollars.toFixed(2),
          });
          router.push(`/book/${params.slug}/success?${q.toString()}`);
          return;
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
                billing_details: {
                  name: guestNameForBooking,
                  email: guestEmailForBooking,
                },
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
            headers: jsonHeaders(accessToken),
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
            guestName: guestNameForBooking,
            guestEmail: guestEmailForBooking,
            amountPaid: grandTotalDollars.toFixed(2),
          });
          router.push(`/book/${params.slug}/success?${q.toString()}`);
          return;
        }
      }

      // Zero-fee path (unchanged from original)
      const body: Record<string, unknown> = {
        playersCount: players,
        guestName: guestNameForBooking,
        guestEmail: guestEmailForBooking,
        notes: notes || undefined,
        clubSlug: params.slug,
      };
      if (slotId) {
        body.teeSlotId = slotId;
      } else {
        body.courseId = courseId;
        body.datetime = datetime;
      }
      const freeAddOns = buildAddOnsPayload();
      if (freeAddOns.length > 0) {
        body.addOns = freeAddOns;
      }

      const res = await fetch(`${API_URL}/api/bookings/public`, {
        method: "POST",
        headers: jsonHeaders(accessToken),
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "ADDON_UNAVAILABLE") {
          setError(
            typeof data.name === "string"
              ? `${data.name} is not available.`
              : "An add-on is not available."
          );
          setSubmitting(false);
          return;
        }
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
        guestName: guestNameForBooking,
        guestEmail: guestEmailForBooking,
      });
      router.push(`/book/${params.slug}/success?${q.toString()}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
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

  const submitButtonLabel =
    submitting ? (
      <span className="relative z-[1] flex items-center justify-center gap-2">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {requiresPayment ? "Processing payment..." : "Reserving..."}
      </span>
    ) : (
      <span className="relative z-[1]">
        {contactCompleteFromSession
          ? requiresPayment
            ? `Pay $${grandTotalDollars.toFixed(2)} & confirm`
            : "Confirm reservation"
          : requiresPayment
            ? `Pay $${grandTotalDollars.toFixed(2)} & Reserve`
            : "Reserve tee time"}
      </span>
    );

  return (
    <div className="min-h-screen bg-ds-warm-white pb-10">
      <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center gap-3 border-b border-ds-stone bg-ds-warm-white px-4">
        <button
          type="button"
          onClick={goBackOrExit}
          className="flex items-center gap-1 text-[13px] font-medium text-ds-fairway"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>
        <h1 className="font-display text-base text-ds-ink">
          {contactCompleteFromSession ? "Confirm your tee time" : "Confirm booking"}
        </h1>
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
          {addonSubtotalCents > 0 && (
            <p className="relative mt-1.5 text-[13px] text-white/65">
              Add-ons:{" "}
              <span className="font-semibold text-white">${(addonSubtotalCents / 100).toFixed(2)}</span>
            </p>
          )}
          {(totalFee > 0 || addonSubtotalCents > 0) && (
            <p className="relative mt-1.5 text-[13px] font-semibold text-white">
              Total: ${grandTotalDollars.toFixed(2)}
            </p>
          )}
          <p className="relative mt-3 inline-flex items-center gap-1 rounded-full border border-ds-gold/35 bg-ds-gold/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ds-gold-light">
            {slotType.replace("hole", " holes")}
          </p>
        </div>

        <StepIndicator steps={steps} stepIdx={stepIdx} />

        {currentStep === "details" && showGuestRegistrationBanner && (
          <div className="mb-4 flex gap-2.5 rounded-[10px] border border-ds-fairway/25 bg-ds-fairway/[0.06] px-3.5 py-3 text-xs leading-relaxed text-ds-muted">
            <span className="mt-0.5 shrink-0 text-ds-fairway" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </span>
            <p className="text-ds-ink">
              Want faster bookings?{" "}
              <Link href="/register" className="font-semibold text-ds-fairway underline-offset-2 hover:underline">
                Create a free account →
              </Link>{" "}
              to save your details and manage your bookings.
            </p>
          </div>
        )}

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

        {currentStep === "details" && (
          <StepDetails
            contactCompleteFromSession={contactCompleteFromSession}
            isAuthed={isAuthed}
            sessionName={sessionName}
            sessionEmail={sessionEmail}
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            notes={notes}
            setNotes={setNotes}
            detailsValid={detailsValid()}
            onContinue={() => {
              if (!detailsValid()) return;
              setStepIdx((i) => Math.min(steps.length - 1, i + 1));
            }}
          />
        )}

        {currentStep === "addons" && (
          <StepAddOns
            addonCatalog={addonCatalog}
            addonQty={addonQty}
            setAddonQty={setAddonQty}
            addonSubtotalCents={addonSubtotalCents}
            onContinue={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
          />
        )}

        {currentStep === "payment" && (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <StepPayment
              players={players}
              bookingFee={bookingFee}
              totalFee={totalFee}
              addonCatalog={addonCatalog}
              addonQty={addonQty}
              addonSubtotalCents={addonSubtotalCents}
              grandTotalDollars={grandTotalDollars}
              requiresPayment={requiresPayment}
              cardElementOptions={cardElementOptions}
              error={error}
              submitting={submitting}
              guestEmailForBooking={guestEmailForBooking}
              guestNameForBooking={guestNameForBooking}
              childrenSubmitButton={submitButtonLabel}
            />
          </form>
        )}

        <button
          type="button"
          onClick={goBackOrExit}
          className="mt-4 w-full text-center text-[13px] text-ds-muted underline decoration-transparent hover:decoration-ds-muted"
        >
          Back to tee times
        </button>
      </div>
    </div>
  );
}

// Wrapper that fetches club data and provides Stripe Elements context
function ConfirmForm({
  params,
  showGuestRegistrationBanner,
  sessionUser,
}: {
  params: { slug: string };
  showGuestRegistrationBanner: boolean;
  sessionUser: { name: string | null; email: string | null } | null;
}) {
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
        <ConfirmFormInner
          params={params}
          club={club}
          showGuestRegistrationBanner={showGuestRegistrationBanner}
          sessionUser={sessionUser}
        />
      </Elements>
    );
  }

  // Stripe not configured — render without Elements (zero-fee clubs only)
  return (
    <ConfirmFormInner
      params={params}
      club={club}
      showGuestRegistrationBanner={showGuestRegistrationBanner}
      sessionUser={sessionUser}
    />
  );
}

export function ConfirmBookingClient({
  params,
  showGuestRegistrationBanner,
  sessionUser = null,
}: {
  params: { slug: string };
  showGuestRegistrationBanner: boolean;
  sessionUser?: { name: string | null; email: string | null } | null;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ds-warm-white text-ds-muted">
          Loading…
        </div>
      }
    >
      <ConfirmForm
        params={params}
        showGuestRegistrationBanner={showGuestRegistrationBanner}
        sessionUser={sessionUser}
      />
    </Suspense>
  );
}
