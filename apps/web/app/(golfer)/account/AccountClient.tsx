"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import GolferBookingsSection from "@/components/golfer/GolferBookingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MeBookingsResponse, ScorecardItem } from "@/lib/golfer-types";
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

function memberSinceYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getFullYear());
}

function bestScoreFrom(scorecards: ScorecardItem[]): number | null {
  const scores = scorecards
    .map((s) => s.totalScore)
    .filter((n) => typeof n === "number" && Number.isFinite(n) && n > 0);
  if (scores.length === 0) return null;
  return Math.min(...scores);
}

function displayName(profile: ProfileData): string {
  const n = (profile.name ?? "").trim();
  if (n) return n;
  const local = profile.email.split("@")[0]?.trim();
  if (local) return local;
  return "Golfer";
}

function initialsFor(profile: ProfileData): string {
  const n = (profile.name ?? "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (
        (parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")
      ).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  return profile.email.slice(0, 2).toUpperCase();
}

export default function AccountClient({
  profile,
  accessToken,
  scorecards,
  bookings,
}: {
  profile: ProfileData;
  accessToken: string;
  scorecards: ScorecardItem[];
  bookings: {
    upcoming: MeBookingsResponse["upcoming"];
    past: MeBookingsResponse["past"];
    totalUpcoming: number;
    totalPast: number;
    upPage: number;
    pastPage: number;
    limit: number;
  };
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const authToken = session?.accessToken ?? accessToken;

  const [initialProfile, setInitialProfile] = useState(profile);
  const [name, setName] = useState(profile.name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [reminders, setReminders] = useState(remindersFromProfile(profile));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setInitialProfile(profile);
    setName(profile.name ?? "");
    setPhone(profile.phone ?? "");
    setReminders(remindersFromProfile(profile));
  }, [profile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") !== "bookings") return;
    requestAnimationFrame(() => {
      document.getElementById("bookings")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    params.delete("section");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/account?${qs}` : "/account");
  }, []);

  const hasChanges = useMemo(() => {
    const initName = (initialProfile.name ?? "").trim();
    if (name.trim() !== initName) return true;
    if (normalizePhone(phone) !== normalizePhone(initialProfile.phone)) return true;
    if (reminders !== remindersFromProfile(initialProfile)) return true;
    return false;
  }, [initialProfile, name, phone, reminders]);

  const heroName = displayName({ ...profile, name });
  const memberYear = memberSinceYear(initialProfile.createdAt);
  const bestScore = bestScoreFrom(scorecards);
  const onAccount = pathname === "/account";

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
    <div className="min-h-screen bg-ds-cream pb-16 text-ds-ink antialiased">
      <header className="flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-ds-forest px-5 lg:h-16 lg:px-12">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 font-display text-lg text-white lg:text-xl"
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ds-gold text-sm font-bold text-ds-forest"
            aria-hidden
          >
            T
          </span>
          <span className="truncate">TeeTimes</span>
        </Link>
        <nav
          className="flex shrink-0 items-center gap-4 text-[12px] font-medium lg:gap-7 lg:text-[13px]"
          aria-label="Golfer navigation"
        >
          <Link
            href="/"
            className={cn(
              "transition-colors",
              onAccount ? "text-white/70 hover:text-white" : "text-white/80"
            )}
          >
            Discover
          </Link>
          <Link
            href="/search"
            className="text-white/70 transition-colors hover:text-white"
          >
            Search
          </Link>
          <span className="cursor-not-allowed text-white/40 lg:inline" aria-hidden>
            Saved
          </span>
          <Link
            href="/account"
            className={cn(
              onAccount ? "text-ds-gold" : "text-white/80 hover:text-white"
            )}
          >
            My bookings
          </Link>
        </nav>
      </header>

      <div className="lg:mx-auto lg:w-full lg:max-w-lg xl:max-w-xl">
        <div className="bg-ds-forest px-5 pb-10 pt-6 lg:px-6 lg:pb-12 lg:pt-7">
        <p className="text-[11px] font-normal uppercase tracking-[0.12em] text-ds-gold">
          Golfer profile
        </p>
        <h1 className="mt-2 font-display text-[32px] font-bold leading-tight tracking-tight text-white lg:text-[38px]">
          {heroName}
        </h1>
        <p className="mt-2 text-sm font-light text-white/55">
          {initialProfile.email}
          {memberYear ? (
            <>
              {" "}
              · Member since {memberYear}
            </>
          ) : null}
        </p>

        <div className="mt-7 grid grid-cols-3 gap-px overflow-hidden rounded-t-lg bg-ds-fairway/40">
          {[
            { value: bookings.totalPast, label: "Rounds played" },
            {
              value: bestScore !== null ? String(bestScore) : "—",
              label: "Best score",
            },
            { value: bookings.totalUpcoming, label: "Upcoming" },
          ].map((cell) => (
            <div
              key={cell.label}
              className="bg-ds-forest px-3 py-4 text-center lg:px-5 lg:py-4"
            >
              <p className="font-display text-[24px] leading-none text-ds-gold-light lg:text-[26px]">
                {cell.value}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white/50">
                {cell.label}
              </p>
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="lg:mx-auto lg:w-full lg:max-w-lg xl:max-w-xl">
        <section
          id="bookings"
          className="scroll-mt-8 border-b border-ds-stone bg-ds-warm-white px-5 py-5 shadow-sm lg:px-6"
          aria-labelledby="upcoming-tee-times-heading"
        >
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ds-gold">
            Bookings
          </p>
          <h2
            id="upcoming-tee-times-heading"
            className="flex items-center gap-2.5 font-display text-[22px] leading-tight text-ds-forest lg:text-2xl"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-ds-grass" aria-hidden />
            Upcoming tee times
          </h2>
        </section>

        <div className="w-full px-5 pt-6 lg:px-6">
        <GolferBookingsSection
          upcoming={bookings.upcoming}
          past={bookings.past}
          totalUpcoming={bookings.totalUpcoming}
          totalPast={bookings.totalPast}
          upPage={bookings.upPage}
          pastPage={bookings.pastPage}
          limit={bookings.limit}
          accessToken={accessToken}
          initialScorecards={scorecards}
        />

        <section className="mt-2" aria-labelledby="score-history-heading">
          <h2
            id="score-history-heading"
            className="mb-3 mt-8 text-[10px] font-bold uppercase tracking-[0.14em] text-ds-gold"
          >
            Score history
          </h2>
          <div className="space-y-2.5">
            {scorecards.length === 0 ? (
              <div className="rounded-[14px] border border-ds-stone bg-ds-warm-white px-5 py-10 text-center shadow-sm">
                <p className="font-display text-lg text-ds-ink">No scores yet</p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ds-muted">
                  Your round scores will appear here once you log them from a past
                  booking.
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
                    className="flex items-center justify-between gap-3 rounded-[14px] border border-ds-stone bg-ds-warm-white px-5 py-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ds-forest">
                        {formatRoundDate(dateIso)}
                      </p>
                      <p className="mt-0.5 text-[12px] font-light text-ds-muted">
                        {courseName}
                        <span className="text-ds-stone"> · </span>
                        {clubName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-1 rounded-lg bg-ds-forest px-3 py-1.5">
                      <span className="font-display text-[22px] leading-none text-ds-gold-light">
                        {sc.totalScore}
                      </span>
                      <span className="text-[11px] text-white/50">
                        / {sc.completedHoles} holes
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section id="profile" className="mt-2 scroll-mt-8" aria-labelledby="profile-heading">
          <h2
            id="profile-heading"
            className="mb-3 mt-8 text-[10px] font-bold uppercase tracking-[0.14em] text-ds-gold"
          >
            Profile
          </h2>
          <div className="overflow-hidden rounded-[14px] border border-ds-stone bg-ds-warm-white shadow-sm">
            <form
              className="px-5 py-5"
              onSubmit={(e) => void handleSubmit(e)}
            >
              <div className="mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-ds-forest font-display text-lg text-ds-gold-light">
                {initialsFor({ ...initialProfile, name: name || initialProfile.name })}
              </div>
              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="account-name"
                    className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-ds-muted"
                  >
                    Name
                  </label>
                  <Input
                    id="account-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    className="border-ds-stone bg-ds-cream text-ds-forest placeholder:text-ds-muted focus-visible:border-ds-grass focus-visible:ring-0"
                  />
                </div>
                <div>
                  <label
                    htmlFor="account-phone"
                    className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-ds-muted"
                  >
                    Phone <span className="font-normal">(optional)</span>
                  </label>
                  <Input
                    id="account-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +1 555-0100"
                    autoComplete="tel"
                    className="border-ds-stone bg-ds-cream text-ds-forest placeholder:text-ds-muted focus-visible:border-ds-grass focus-visible:ring-0"
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ds-muted">
                    Email
                  </p>
                  <div className="rounded-lg border border-ds-stone bg-ds-cream/80 px-3 py-2.5 text-sm text-ds-muted">
                    {initialProfile.email}
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px] text-ds-ink">
                  <input
                    id="account-reminders"
                    type="checkbox"
                    checked={reminders}
                    onChange={(e) => setReminders(e.target.checked)}
                    className="h-4 w-4 rounded border-ds-stone text-ds-fairway focus:ring-ds-grass"
                  />
                  Email reminders before tee times
                </label>
                {saveError && (
                  <p className="text-sm text-red-700" role="alert">
                    {saveError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={saving || !hasChanges}
                  className="mt-2 w-full rounded-lg border-0 bg-ds-forest py-2.5 text-[13px] font-semibold tracking-wide text-ds-gold-light hover:bg-ds-forest hover:opacity-90 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <button
          type="button"
          className="mt-8 inline-flex items-center gap-1 text-[13px] text-ds-muted transition-colors hover:text-ds-ink"
          onClick={() =>
            window.scrollTo({ top: 0, behavior: "smooth" })
          }
        >
          ↑ Back to top
        </button>
        </div>
      </div>
    </div>
  );
}
