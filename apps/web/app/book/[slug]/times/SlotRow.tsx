"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface TimesSlot {
  id: string | null;
  datetime: string;
  maxPlayers: number;
  bookedPlayers: number;
  status: string;
  price: number | null;
  slotType: string;
}

function formatTime(datetime: string, timezone: string): string {
  return new Date(datetime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function SlotRow({
  slot,
  available,
  timezone,
  onSelect,
  clubSlug,
  waitlistEnabled,
}: {
  slot: TimesSlot;
  available: boolean;
  timezone: string;
  onSelect: () => void;
  clubSlug: string;
  waitlistEnabled: boolean;
}) {
  const spots = slot.maxPlayers - slot.bookedPlayers;
  const slotFullyBooked =
    slot.bookedPlayers >= slot.maxPlayers && slot.status === "open";
  const showWaitlist =
    waitlistEnabled &&
    Boolean(slot.id) &&
    slotFullyBooked;

  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [wlPlayers, setWlPlayers] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const maxWlPlayers = Math.min(4, slot.maxPlayers);

  async function submitWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!slot.id) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `${API_URL}/api/clubs/public/${encodeURIComponent(clubSlug)}/waitlist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teeSlotId: slot.id,
            name: name.trim(),
            email: email.trim(),
            playersCount: Math.min(Math.max(1, wlPlayers), maxWlPlayers),
          }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        position?: number;
      };
      if (res.status === 403 && data.code === "WAITLIST_DISABLED") {
        setErrorMessage("Waitlist is not available.");
        return;
      }
      if (res.ok) {
        setExpanded(false);
        setDoneMessage(
          "You're on the waitlist — we'll email you if a spot opens."
        );
        setName("");
        setEmail("");
        setWlPlayers(1);
        return;
      }
      if (res.status === 409 && data.code === "ALREADY_ON_WAITLIST") {
        setErrorMessage("You're already on the waitlist for this time.");
        return;
      }
      setErrorMessage("Could not join the waitlist. Please try again.");
    } catch {
      setErrorMessage("Could not join the waitlist. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (showWaitlist) {
    return (
      <li>
        <div className="border-b border-ds-stone bg-ds-warm-white">
          <div className="flex w-full items-center gap-3 px-4 py-3">
            <span className="min-w-[72px] font-display text-[15px] text-ds-ink">
              {formatTime(slot.datetime, timezone)}
            </span>
            <div className="flex flex-1 flex-wrap items-center gap-1">
              {Array.from({ length: slot.maxPlayers }).map((_, i) => (
                <span
                  key={i}
                  className={`h-[9px] w-[9px] rounded-full ${
                    i < slot.bookedPlayers ? "bg-ds-stone" : "bg-ds-grass"
                  }`}
                />
              ))}
              <span className="ml-1 text-[11px] text-ds-muted">Full</span>
            </div>
            {slot.price != null && (
              <span className="text-[13px] font-semibold text-ds-muted">
                ${slot.price}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setExpanded((v) => !v);
                setErrorMessage(null);
                setDoneMessage(null);
              }}
              className="shrink-0 rounded-lg border-2 border-amber-600 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-amber-800 hover:bg-amber-50"
            >
              Join Waitlist
            </button>
          </div>
          {doneMessage && (
            <p className="border-t border-ds-stone bg-ds-cream px-4 py-2 text-[13px] text-ds-ink">
              {doneMessage}
            </p>
          )}
          {expanded && !doneMessage && (
            <form
              onSubmit={submitWaitlist}
              className="space-y-3 border-t border-ds-stone bg-ds-cream px-4 py-3"
            >
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">
                  Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ds-stone bg-white px-3 py-2 text-sm text-ds-ink"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ds-stone bg-white px-3 py-2 text-sm text-ds-ink"
                  autoComplete="email"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">
                  Players
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setWlPlayers((p) => Math.max(1, p - 1))
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-ds-stone bg-white text-ds-ink"
                  >
                    −
                  </button>
                  <span className="min-w-[1.25rem] text-center font-display text-lg text-ds-ink">
                    {Math.min(wlPlayers, maxWlPlayers)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setWlPlayers((p) => Math.min(maxWlPlayers, p + 1))
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-ds-stone bg-white text-ds-ink"
                  >
                    +
                  </button>
                </div>
              </div>
              {errorMessage && (
                <p className="text-sm text-amber-900">{errorMessage}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-amber-600 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Joining…" : "Join Waitlist"}
              </button>
            </form>
          )}
        </div>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={available ? onSelect : undefined}
        disabled={!available}
        className={`flex w-full items-center gap-3 border-b border-ds-stone px-4 py-3 text-left transition-colors ${
          available
            ? "cursor-pointer bg-ds-warm-white hover:bg-ds-cream"
            : "cursor-not-allowed opacity-40"
        }`}
      >
        <span
          className={`min-w-[72px] font-display text-[15px] ${available ? "text-ds-ink" : "text-ds-muted"}`}
        >
          {formatTime(slot.datetime, timezone)}
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {Array.from({ length: slot.maxPlayers }).map((_, i) => (
            <span
              key={i}
              className={`h-[9px] w-[9px] rounded-full ${i < slot.bookedPlayers ? "bg-ds-stone" : "bg-ds-grass"}`}
            />
          ))}
          <span
            className={`ml-1 text-[11px] ${available ? "text-ds-muted" : "text-ds-muted"}`}
          >
            {available ? `${spots} spot${spots !== 1 ? "s" : ""}` : "Full"}
          </span>
        </div>
        {slot.price != null && (
          <span
            className={`text-[13px] font-semibold ${available ? "text-ds-fairway" : "text-ds-muted"}`}
          >
            ${slot.price}
          </span>
        )}
        <span className="text-ds-stone" aria-hidden>
          ›
        </span>
      </button>
    </li>
  );
}
