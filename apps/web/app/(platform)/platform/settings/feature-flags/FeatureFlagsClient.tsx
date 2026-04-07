"use client";

import { toast } from "sonner";
import { useState } from "react";
import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { cn } from "@/lib/utils";

const FLAGS: { key: string; title: string; description: string }[] = [
  {
    key: "features.onlineBooking",
    title: "Online Booking",
    description: "Allow golfers to book tee times online",
  },
  {
    key: "features.cancellation",
    title: "Cancellation",
    description: "Allow golfers to cancel bookings",
  },
  {
    key: "features.guestBooking",
    title: "Guest Booking",
    description: "Allow booking without an account",
  },
  {
    key: "features.waitlist",
    title: "Waitlist",
    description: "Enable waitlist for fully-booked slots",
  },
];

function bool(v: unknown): boolean {
  return v === true;
}

export function FeatureFlagsClient({
  initialSettings,
}: {
  initialSettings: Record<string, unknown>;
}) {
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const f of FLAGS) {
      m[f.key] = bool(initialSettings[f.key]);
    }
    return m;
  });
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function toggle(key: string, next: boolean) {
    const prev = values[key];
    setValues((v) => ({ ...v, [key]: next }));
    setPendingKey(key);
    try {
      const res = await fetch(`/api/platform/settings/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setValues((v) => ({ ...v, [key]: prev }));
        toast.error(data.error ?? "Failed to update flag");
        return;
      }
    } catch {
      setValues((v) => ({ ...v, [key]: prev }));
      toast.error("Failed to update flag");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <>
      <SetPlatformTopBar
        title="Feature flags"
        backLink={{ href: "/platform/settings", label: "← Settings" }}
      />
      <div className="p-6">
        <p className="mb-5 text-sm text-muted">
          Enable or disable platform features for all clubs.
        </p>
        <div className="overflow-hidden rounded-xl border border-stone bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone bg-cream/80">
                <th className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wide text-muted">
                  Feature
                </th>
                <th className="hidden px-4 py-3 font-display text-xs font-semibold uppercase tracking-wide text-muted sm:table-cell">
                  Description
                </th>
                <th className="w-24 px-4 py-3 text-right font-display text-xs font-semibold uppercase tracking-wide text-muted">
                  On
                </th>
              </tr>
            </thead>
            <tbody>
              {FLAGS.map((f) => {
                const on = values[f.key] ?? false;
                const busy = pendingKey === f.key;
                return (
                  <tr key={f.key} className="border-b border-stone last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{f.title}</td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">
                      {f.description}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <span className="sr-only">{f.title}</span>
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={on}
                          disabled={busy}
                          onChange={(e) => void toggle(f.key, e.target.checked)}
                        />
                        <span
                          className={cn(
                            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-stone transition-colors",
                            on ? "border-fairway bg-fairway" : "bg-stone/40"
                          )}
                          aria-hidden
                        >
                          <span
                            className={cn(
                              "ml-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                              on ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
