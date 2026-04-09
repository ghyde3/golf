"use client";

import { useState } from "react";

type Props = {
  clubId: string;
  initialBookingFee: string | null;
};

/**
 * Default per-player green fee on `clubs.booking_fee` (used for public checkout and
 * reports when a tee slot has no per-slot price).
 */
export function BookingFeeEditor({ clubId, initialBookingFee }: Props) {
  const [value, setValue] = useState(() => initialBookingFee?.trim() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const trimmed = value.trim();
      if (trimmed === "") {
        setError("Enter an amount in USD (use 0 if there is no green fee).");
        return;
      }
      if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
        setError("Use a number like 65 or 65.00.");
        return;
      }
      const res = await fetch(`/api/clubs/${clubId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingFee: trimmed }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not save green fee."
        );
        return;
      }
      setSuccess("Saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="mt-6 space-y-3 border-t border-stone pt-6">
      <div>
        <label
          htmlFor="booking-fee"
          className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted"
        >
          Default green fee (per player)
        </label>
        <p className="mb-2 text-xs text-muted">
          Shown to golfers at checkout and used for revenue when a tee time does not
          have its own price. Per-slot prices on the tee sheet override this.
        </p>
        <div className="flex max-w-xs flex-wrap items-center gap-2">
          <span className="text-sm text-muted">$</span>
          <input
            id="booking-fee"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSuccess("");
              setError("");
            }}
            placeholder="65.00"
            className="min-w-[6rem] flex-1 rounded-lg border border-stone px-3 py-2 text-sm text-ink placeholder-muted focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-fairway/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {success && <p className="text-sm text-green-800">{success}</p>}
      </div>
    </form>
  );
}
