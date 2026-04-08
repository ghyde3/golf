"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScorecardItem } from "../my-bookings/page";
import type { ProfileData } from "./page";

function formatRoundDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function normalizePhone(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return t === "" ? null : t;
}

function remindersFromProfile(p: ProfileData): boolean {
  return p.notificationPrefs?.reminders ?? false;
}

export default function AccountClient({
  profile,
  accessToken,
  scorecards,
}: {
  profile: ProfileData;
  accessToken: string;
  scorecards: ScorecardItem[];
}) {
  const { data: session } = useSession();
  const authToken = session?.accessToken ?? accessToken;

  const [initialProfile, setInitialProfile] = useState(profile);
  const [name, setName] = useState(profile.name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [reminders, setReminders] = useState(remindersFromProfile(profile));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasChanges = useMemo(() => {
    const initName = (initialProfile.name ?? "").trim();
    if (name.trim() !== initName) return true;
    if (normalizePhone(phone) !== normalizePhone(initialProfile.phone)) return true;
    if (reminders !== remindersFromProfile(initialProfile)) return true;
    return false;
  }, [initialProfile, name, phone, reminders]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError("Name is required.");
      return;
    }

    const body: {
      name?: string;
      phone?: string | null;
      notificationPrefs?: { reminders: boolean };
    } = {};

    const initName = (initialProfile.name ?? "").trim();
    if (trimmedName !== initName) body.name = trimmedName;

    const curPhone = normalizePhone(phone);
    const initPhone = normalizePhone(initialProfile.phone);
    if (curPhone !== initPhone) body.phone = curPhone;

    if (reminders !== remindersFromProfile(initialProfile)) {
      body.notificationPrefs = { reminders };
    }

    if (Object.keys(body).length === 0) {
      return;
    }

    const token = authToken?.trim();
    if (!token) {
      setSaveError("Sign in to save your profile.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/me/profile`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as
        | ProfileData
        | { error?: string };
      if (res.status === 401) {
        setSaveError("Session expired — please sign in again.");
        return;
      }
      if (!res.ok) {
        setSaveError(
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Could not save profile."
        );
        return;
      }
      const next = payload as ProfileData;
      setInitialProfile(next);
      setName(next.name ?? "");
      setPhone(next.phone ?? "");
      setReminders(remindersFromProfile(next));
      toast.success("Profile saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
        Golfer
      </p>
      <h1 className="mt-1 font-display text-[28px] text-ds-forest">Account</h1>
      <p className="mt-2 text-sm text-ds-muted">
        Manage your profile and notification preferences.
      </p>

      <section className="mt-10">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
          Profile
        </h2>
        <form
          className="mt-3 space-y-4 rounded-2xl border-[1.5px] border-ds-stone bg-white p-4 shadow-sm"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <div>
            <label
              htmlFor="account-name"
              className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold"
            >
              Name
            </label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              className="border-ds-stone"
            />
          </div>
          <div>
            <label
              htmlFor="account-phone"
              className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold"
            >
              Phone <span className="font-normal text-ds-muted">(optional)</span>
            </label>
            <Input
              id="account-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +1 555-0100"
              autoComplete="tel"
              className="border-ds-stone"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
              Email
            </p>
            <p className="text-sm text-ds-ink">{initialProfile.email}</p>
          </div>
          <div className="flex items-start gap-3 pt-1">
            <input
              id="account-reminders"
              type="checkbox"
              checked={reminders}
              onChange={(e) => setReminders(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ds-stone text-ds-fairway focus:ring-ds-fairway"
            />
            <label htmlFor="account-reminders" className="text-sm text-ds-ink">
              Email reminders before tee times
            </label>
          </div>
          {saveError && (
            <p className="text-sm text-amber-800" role="alert">
              {saveError}
            </p>
          )}
          <Button type="submit" disabled={saving || !hasChanges}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
          Score history
        </h2>
        <div className="mt-3 space-y-3">
          {scorecards.length === 0 ? (
            <div className="rounded-2xl border-[1.5px] border-ds-stone bg-white p-4 shadow-sm">
              <p className="text-sm text-ds-muted">
                Your round scores will appear here once you log them from My
                bookings.
              </p>
            </div>
          ) : (
            scorecards.map((sc) => {
              const ts = sc.booking?.teeSlot;
              const dateIso = ts?.datetime ?? sc.createdAt ?? null;
              const courseName = ts?.courseName ?? "Round";
              const clubName = ts?.clubName ?? "—";
              return (
                <div
                  key={sc.id}
                  className="rounded-2xl border-[1.5px] border-ds-stone bg-white p-4 shadow-sm"
                >
                  <p className="font-display text-base text-ds-ink">
                    {formatRoundDate(dateIso)}
                  </p>
                  <p className="mt-1 text-sm text-ds-ink">
                    {courseName}
                    <span className="text-ds-muted"> · </span>
                    {clubName}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
                    <span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                        Total
                      </span>{" "}
                      <span className="font-display text-lg tabular-nums text-ds-forest">
                        {sc.totalScore}
                      </span>
                    </span>
                    <span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                        Holes
                      </span>{" "}
                      <span className="text-ds-ink">
                        {sc.completedHoles} completed
                      </span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <Link
        href="/my-bookings"
        className="mt-10 inline-block text-sm font-medium text-ds-fairway underline-offset-4 hover:underline"
      >
        ← My bookings
      </Link>
    </div>
  );
}
