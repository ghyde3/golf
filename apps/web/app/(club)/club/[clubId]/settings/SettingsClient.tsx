"use client";

import { useState } from "react";
import { SetTopBar } from "@/components/club/ClubTopBarContext";

export type ConfigRow = {
  id: string;
  effectiveFrom: string;
  slotIntervalMinutes: number | null;
  bookingWindowDays: number | null;
  cancellationHours: number | null;
  openTime: string | null;
  closeTime: string | null;
  timezone: string | null;
  primaryColor: string | null;
};

type FormValues = {
  slotIntervalMinutes: 8 | 10 | 12;
  bookingWindowDays: number;
  cancellationHours: number;
  openTime: string;
  closeTime: string;
  timezone: string;
  effectiveFrom: string;
};

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function initForm(current: ConfigRow | undefined): FormValues {
  return {
    slotIntervalMinutes: (current?.slotIntervalMinutes as 8 | 10 | 12) ?? 10,
    bookingWindowDays: current?.bookingWindowDays ?? 14,
    cancellationHours: current?.cancellationHours ?? 24,
    openTime: current?.openTime ?? "06:00",
    closeTime: current?.closeTime ?? "18:00",
    timezone: current?.timezone ?? "America/New_York",
    effectiveFrom: today(),
  };
}

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function SettingsClient({
  clubId,
  configs: initial,
}: {
  clubId: string;
  configs: ConfigRow[];
}) {
  const [configs, setConfigs] = useState<ConfigRow[]>(initial);
  const current = configs[0];
  const history = configs.slice(1);

  const [form, setForm] = useState<FormValues>(() => initForm(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotIntervalMinutes: form.slotIntervalMinutes,
          bookingWindowDays: form.bookingWindowDays,
          cancellationHours: form.cancellationHours,
          openTime: form.openTime,
          closeTime: form.closeTime,
          timezone: form.timezone,
          effectiveFrom: form.effectiveFrom,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error ?? "Failed to save settings"
        );
        return;
      }
      const newRow = (await res.json()) as { id: string; effectiveFrom: string };
      const newConfig: ConfigRow = {
        id: newRow.id,
        effectiveFrom: newRow.effectiveFrom,
        slotIntervalMinutes: form.slotIntervalMinutes,
        bookingWindowDays: form.bookingWindowDays,
        cancellationHours: form.cancellationHours,
        openTime: form.openTime,
        closeTime: form.closeTime,
        timezone: form.timezone,
        primaryColor: current?.primaryColor ?? null,
      };
      setConfigs((prev) => [newConfig, ...prev]);
      setSuccess("Settings saved. Changes take effect from " + form.effectiveFrom + ".");
      setForm((f) => ({ ...f, effectiveFrom: today() }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SetTopBar title="Settings" />
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
        <div>
          <h2 className="font-display text-xl text-ink">Settings</h2>
          <p className="mt-1 text-sm text-muted">
            Club operational settings. Changes create a new versioned config row
            effective from the date you choose.
          </p>
        </div>

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {/* Main settings form */}
        <div className="rounded-xl border border-stone bg-white shadow-sm">
          <div className="border-b border-stone px-4 py-3">
            <h3 className="font-display text-lg text-ink">Operational config</h3>
          </div>
          <form onSubmit={handleSubmit} className="divide-y divide-stone">
            {/* Slot interval */}
            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[200px_1fr]">
              <div>
                <label className="block text-sm font-semibold text-ink">
                  Tee time interval
                </label>
                <p className="mt-0.5 text-xs text-muted">Minutes between slots</p>
              </div>
              <div className="flex gap-2">
                {([8, 10, 12] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setField("slotIntervalMinutes", v)}
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                      form.slotIntervalMinutes === v
                        ? "border-fairway bg-fairway text-white"
                        : "border-stone bg-white text-ink hover:border-fairway/50"
                    }`}
                  >
                    {v} min
                  </button>
                ))}
              </div>
            </div>

            {/* Booking window */}
            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[200px_1fr]">
              <div>
                <label
                  htmlFor="bookingWindowDays"
                  className="block text-sm font-semibold text-ink"
                >
                  Booking window
                </label>
                <p className="mt-0.5 text-xs text-muted">Days in advance</p>
              </div>
              <input
                id="bookingWindowDays"
                type="number"
                min={1}
                max={90}
                value={form.bookingWindowDays}
                onChange={(e) =>
                  setField("bookingWindowDays", Number(e.target.value))
                }
                className="w-24 rounded-lg border border-stone px-3 py-2 text-sm text-ink focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
              />
            </div>

            {/* Cancellation hours */}
            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[200px_1fr]">
              <div>
                <label
                  htmlFor="cancellationHours"
                  className="block text-sm font-semibold text-ink"
                >
                  Cancellation window
                </label>
                <p className="mt-0.5 text-xs text-muted">Hours before tee time</p>
              </div>
              <input
                id="cancellationHours"
                type="number"
                min={0}
                value={form.cancellationHours}
                onChange={(e) =>
                  setField("cancellationHours", Number(e.target.value))
                }
                className="w-24 rounded-lg border border-stone px-3 py-2 text-sm text-ink focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
              />
            </div>

            {/* Open / close time */}
            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[200px_1fr]">
              <div>
                <label className="block text-sm font-semibold text-ink">
                  Operating hours
                </label>
                <p className="mt-0.5 text-xs text-muted">Default open / close</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={form.openTime}
                  onChange={(e) => setField("openTime", e.target.value)}
                  className="rounded-lg border border-stone px-3 py-2 text-sm text-ink focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
                />
                <span className="text-sm text-muted">to</span>
                <input
                  type="time"
                  value={form.closeTime}
                  onChange={(e) => setField("closeTime", e.target.value)}
                  className="rounded-lg border border-stone px-3 py-2 text-sm text-ink focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
                />
              </div>
            </div>

            {/* Timezone */}
            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[200px_1fr]">
              <div>
                <label
                  htmlFor="timezone"
                  className="block text-sm font-semibold text-ink"
                >
                  Timezone
                </label>
                <p className="mt-0.5 text-xs text-muted">Club local timezone</p>
              </div>
              <select
                id="timezone"
                value={form.timezone}
                onChange={(e) => setField("timezone", e.target.value)}
                className="w-full max-w-xs rounded-lg border border-stone px-3 py-2 text-sm text-ink focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
                {!COMMON_TIMEZONES.includes(form.timezone) && (
                  <option value={form.timezone}>{form.timezone}</option>
                )}
              </select>
            </div>

            {/* Effective from */}
            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[200px_1fr]">
              <div>
                <label
                  htmlFor="effectiveFrom"
                  className="block text-sm font-semibold text-ink"
                >
                  Effective from
                </label>
                <p className="mt-0.5 text-xs text-muted">
                  Must be after the current config date
                  {current ? ` (${current.effectiveFrom})` : ""}
                </p>
              </div>
              <input
                id="effectiveFrom"
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setField("effectiveFrom", e.target.value)}
                className="rounded-lg border border-stone px-3 py-2 text-sm text-ink focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-4 py-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              {!error && <span />}
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-fairway px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-fairway/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </form>
        </div>

        {/* Config history */}
        {configs.length > 1 && (
          <div className="rounded-xl border border-stone bg-white shadow-sm">
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <h3 className="font-display text-lg text-ink">Config history</h3>
              <span className="text-sm text-muted">
                {showHistory ? "Hide" : `Show ${history.length} past ${history.length === 1 ? "version" : "versions"}`}
              </span>
            </button>
            {showHistory && (
              <>
                <div className="grid grid-cols-[120px_90px_90px_90px_minmax(0,1fr)] border-t border-stone bg-cream/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                  <span>Effective from</span>
                  <span>Interval</span>
                  <span>Window</span>
                  <span>Cancel hrs</span>
                  <span>Hours</span>
                </div>
                <div className="divide-y divide-stone">
                  {configs.map((c, i) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-[120px_90px_90px_90px_minmax(0,1fr)] items-center px-4 py-3"
                    >
                      <span className="text-sm font-medium text-ink">
                        {c.effectiveFrom}
                        {i === 0 && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-fairway/10 px-1.5 py-0.5 text-[10px] font-semibold text-fairway">
                            current
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-ink">
                        {c.slotIntervalMinutes ?? "—"} min
                      </span>
                      <span className="text-sm text-ink">
                        {c.bookingWindowDays ?? "—"} days
                      </span>
                      <span className="text-sm text-ink">
                        {c.cancellationHours ?? "—"} hrs
                      </span>
                      <span className="text-sm text-muted">
                        {c.openTime ?? "—"} – {c.closeTime ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
