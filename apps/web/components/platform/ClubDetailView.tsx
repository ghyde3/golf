"use client";

import { PlatformClubStatusButton } from "@/components/platform/PlatformClubStatusButton";
import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type ClubDetailPayload = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  description: string | null;
  createdAt: string | null;
  subscriptionType: string | null;
  bookingFee: string | null;
  courses: { id: string; name: string; holes: number }[];
  configs: {
    id: string;
    effectiveFrom: string;
    slotIntervalMinutes: number | null;
    bookingWindowDays: number | null;
    timezone: string | null;
    cancellationHours: number | null;
    openTime: string | null;
    closeTime: string | null;
  }[];
  staff: {
    userId: string;
    role: string;
    name: string | null;
    email: string | null;
  }[];
};

function fmtTime(t: string | null): string {
  if (!t) return "—";
  return t.slice(0, 5);
}

function clubStatusSlot(status: string | null) {
  const s = status ?? "active";
  if (s === "suspended") {
    return <StatusBadge status="no-show" label="Suspended" />;
  }
  return <StatusBadge status="confirmed" label="Active" />;
}

export function ClubDetailView({ club }: { club: ClubDetailPayload }) {
  const [status, setStatus] = useState(club.status ?? "active");

  useEffect(() => {
    setStatus(club.status ?? "active");
  }, [club.id, club.status]);

  const staffCount = club.staff.filter(
    (s) => s.role === "club_admin" || s.role === "staff"
  ).length;

  const bookingFeeDisplay =
    club.bookingFee != null
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(Number(club.bookingFee))
      : "—";

  return (
    <>
      <SetPlatformTopBar
        title={club.name}
        backLink={{ href: "/platform/clubs", label: "← Clubs" }}
        actions={
          <PlatformClubStatusButton
            clubId={club.id}
            clubName={club.name}
            status={status}
            onStatusChange={setStatus}
          />
        }
      />

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-xl border border-stone bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-display text-lg text-ink">Club info</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="border-stone"
                onClick={() => toast.info("Coming soon")}
              >
                Edit
              </Button>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Name
                </dt>
                <dd className="text-ink">{club.name}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Slug
                </dt>
                <dd className="font-mono text-muted">{club.slug}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Public URL
                </dt>
                <dd>
                  <a
                    href={`/book/${club.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-fairway hover:underline"
                  >
                    teetimes.com/book/{club.slug}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Status
                </dt>
                <dd>{clubStatusSlot(status)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Created
                </dt>
                <dd className="text-ink">
                  {club.createdAt
                    ? format(new Date(club.createdAt), "PPP")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Subscription type
                </dt>
                <dd className="capitalize text-ink">
                  {club.subscriptionType ?? "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="font-display mb-3 text-lg text-ink">Courses</h2>
            <div className="overflow-x-auto rounded-xl border border-stone bg-white shadow-sm">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-stone bg-cream/50 text-left text-[10px] font-bold uppercase tracking-widest text-muted">
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Holes</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {club.courses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-center text-muted"
                      >
                        No courses yet.
                      </td>
                    </tr>
                  ) : (
                    club.courses.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-stone transition-colors hover:bg-cream"
                      >
                        <td className="px-4 py-3 font-medium text-ink">
                          {c.name}
                        </td>
                        <td className="px-4 py-3 text-muted">{c.holes}</td>
                        <td className="px-4 py-3">
                          {clubStatusSlot(status)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display mb-3 text-lg text-ink">
              Config history
            </h2>
            <div className="overflow-x-auto rounded-xl border border-stone bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-stone bg-cream/50 text-left text-[10px] font-bold uppercase tracking-widest text-muted">
                    <th className="px-4 py-2 font-medium">Effective from</th>
                    <th className="px-4 py-2 font-medium">Interval</th>
                    <th className="px-4 py-2 font-medium">Hours</th>
                    <th className="px-4 py-2 font-medium">
                      Cancellation window
                    </th>
                    <th className="px-4 py-2 font-medium">Timezone</th>
                  </tr>
                </thead>
                <tbody>
                  {club.configs.map((cfg) => (
                    <tr key={cfg.id} className="border-b border-stone">
                      <td className="px-4 py-3 text-ink">
                        {cfg.effectiveFrom
                          ? format(new Date(cfg.effectiveFrom), "PP")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {cfg.slotIntervalMinutes != null
                          ? `${cfg.slotIntervalMinutes} min`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {cfg.openTime || cfg.closeTime
                          ? `${fmtTime(cfg.openTime)} – ${fmtTime(cfg.closeTime)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {cfg.cancellationHours != null
                          ? `${cfg.cancellationHours} hours`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {cfg.timezone ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
            <h3 className="font-display text-base text-ink">Club actions</h3>
            <div className="mt-3 flex flex-col gap-2">
              <PlatformClubStatusButton
                clubId={club.id}
                clubName={club.name}
                status={status}
                onStatusChange={setStatus}
              />
              <Button variant="secondary" className="border-stone" asChild>
                <Link href={`/book/${club.slug}`} target="_blank">
                  View public page
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
            <h3 className="font-display text-base text-ink">Subscription</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Plan</dt>
                <dd className="font-medium capitalize text-ink">
                  {club.subscriptionType ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Booking fee</dt>
                <dd className="font-medium text-ink">{bookingFeeDisplay}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
            <h3 className="font-display text-base text-ink">Staff</h3>
            <p className="mt-2 text-sm text-muted">
              <span className="font-display text-2xl text-ink">
                {staffCount}
              </span>{" "}
              admin or staff user{staffCount === 1 ? "" : "s"}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
