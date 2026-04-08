"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";
import { UtilisationBar } from "@/components/club/UtilisationBar";
import { Button } from "@/components/ui/button";
import { AddBookingModal } from "@/components/teesheet/AddBookingModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookingDrawer } from "@/components/teesheet/BookingDrawer";
import { BlockSlotModal } from "@/components/teesheet/BlockSlotModal";
import { SlotRow } from "@/components/teesheet/SlotRow";
import type { TeeSlotRow } from "@/components/teesheet/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

type Summary = {
  bookingsToday: number;
  slug: string;
};

type CoursePack = {
  id: string;
  name: string;
  slots: TeeSlotRow[];
};

type DashboardStats = {
  utilisationPct: number;
  revenueToday: number;
  noShows: number;
};

type CourseUtil = {
  id: string;
  name: string;
  pct: number;
  booked: number;
  total: number;
};

function Sparkline({ series }: { series: { bookings: number }[] }) {
  if (series.length < 2) return null;
  const max = Math.max(1, ...series.map((s) => s.bookings));
  const w = 56,
    h = 24,
    pad = 2;
  const pts = series
    .map((s, i) => {
      const x = pad + (i / (series.length - 1)) * (w - pad * 2);
      const y = h - pad - (s.bookings / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DashboardClient({
  clubId,
  dateStr,
  sparklineSeries,
  summary,
  stats,
  courseUtils,
  coursesWithSlots,
  alerts,
}: {
  clubId: string;
  dateStr: string;
  sparklineSeries: { date: string; bookings: number }[];
  summary: Summary;
  stats: DashboardStats;
  courseUtils: CourseUtil[];
  coursesWithSlots: CoursePack[];
  alerts: {
    noShows: boolean;
    fullyBooked: { name: string }[];
    overnight: boolean;
  };
}) {
  const router = useRouter();
  const [activeIdx, setActiveIdx] = useState(0);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSlot, setAddSlot] = useState<TeeSlotRow | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const active = coursesWithSlots[activeIdx] ?? coursesWithSlots[0];
  const previewSlots = useMemo(
    () => (active?.slots ?? []).slice(0, 12),
    [active]
  );

  const nowMs = Date.now();
  const firstUpcoming = previewSlots.findIndex(
    (s) => new Date(s.datetime).getTime() > nowMs
  );

  const coursesMeta = coursesWithSlots.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  async function cancelBooking(id: string) {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("fail");
      toast.success("Booking cancelled");
      setCancelId(null);
      router.refresh();
    } catch {
      toast.error("Could not cancel");
    }
  }

  return (
    <>
      <SetTopBar title="Dashboard" />
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Booked today"
            value={summary.bookingsToday}
            borderClass="border-t-grass"
            footer={
              sparklineSeries.length >= 2 ? (
                <div className="mt-1 text-fairway">
                  <Sparkline series={sparklineSeries} />
                </div>
              ) : null
            }
          />
          <StatCard
            label="Utilisation"
            value={`${Math.round(stats.utilisationPct)}%`}
            borderClass="border-t-gold"
          />
          <StatCard
            label="Revenue today"
            value={new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(stats.revenueToday)}
            borderClass="border-t-blue-400"
          />
          <StatCard
            label="No-shows"
            value={stats.noShows}
            borderClass="border-t-red-400"
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
          <div className="flex min-h-0 flex-col rounded-xl border border-stone bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone px-4 py-3">
              <h2 className="font-display text-lg text-ink">
                Today&apos;s tee sheet
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {coursesWithSlots.map((c, i) => {
                  const u = courseUtils.find((x) => x.id === c.id);
                  const full = u && u.pct >= 100;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={full}
                      onClick={() => setActiveIdx(i)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        i === activeIdx
                          ? "bg-fairway text-white"
                          : full
                            ? "cursor-not-allowed bg-stone/50 text-muted"
                            : "bg-cream text-ink hover:bg-stone/80"
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
                <Link
                  href={`/club/${clubId}/teesheet?date=${encodeURIComponent(dateStr)}`}
                  className="text-xs font-semibold text-fairway hover:underline"
                >
                  Full view →
                </Link>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-[80px_1fr_110px_100px_120px_110px] border-b border-stone bg-cream/50 px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted lg:grid-cols-[80px_1fr_110px_100px_120px_110px]">
                <span>Time</span>
                <span>Guest</span>
                <span>Players</span>
                <span className="hidden lg:block">Price</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              {previewSlots.map((slot, i) => (
                <div key={slot.datetime + String(i)}>
                  {firstUpcoming === i ? (
                    <div className="flex items-center gap-2 border-t border-grass/50 px-6 py-1.5">
                      <div className="h-2 w-2 rounded-full bg-grass" />
                      <span className="text-xs font-bold text-green-700">
                        Now
                      </span>
                    </div>
                  ) : null}
                  <SlotRow
                    slot={slot}
                    nowMs={nowMs}
                    onRowClick={
                      slot.bookingId
                        ? () => {
                            setDrawerId(slot.bookingId!);
                            setDrawerOpen(true);
                          }
                        : undefined
                    }
                    onBook={
                      slot.id
                        ? () => {
                            setAddSlot(slot);
                            setAddOpen(true);
                          }
                        : undefined
                    }
                    onCheckIn={
                      slot.bookingId
                        ? () => {
                            setDrawerId(slot.bookingId!);
                            setDrawerOpen(true);
                          }
                        : undefined
                    }
                    onCancel={
                      slot.bookingId
                        ? () => setCancelId(slot.bookingId!)
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
              <h3 className="font-display text-base text-ink">Alerts</h3>
              <ul className="mt-3 space-y-3 text-sm">
                {alerts.noShows ? (
                  <li className="flex gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    <div>
                      <p className="font-medium text-ink">No-shows today</p>
                      <p className="text-muted">Follow up with guests.</p>
                    </div>
                  </li>
                ) : null}
                {alerts.fullyBooked.map((c) => (
                  <li key={c.name} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <div>
                      <p className="font-medium text-ink">{c.name} is full</p>
                      <p className="text-muted">100% of slots booked.</p>
                    </div>
                  </li>
                ))}
                {alerts.overnight ? (
                  <li className="flex gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-grass" />
                    <div>
                      <p className="font-medium text-ink">New overnight bookings</p>
                      <p className="text-muted">Guests booked since yesterday.</p>
                    </div>
                  </li>
                ) : null}
                {!alerts.noShows &&
                alerts.fullyBooked.length === 0 &&
                !alerts.overnight ? (
                  <li className="text-muted">No alerts right now.</li>
                ) : null}
              </ul>
            </div>

            <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
              <h3 className="font-display text-base text-ink">Quick actions</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  className="border-stone"
                  onClick={() => {
                    setAddSlot(null);
                    setAddOpen(true);
                  }}
                >
                  Add booking
                </Button>
                <Button
                  variant="secondary"
                  className="border-stone"
                  onClick={() => setBlockOpen(true)}
                >
                  Block slot
                </Button>
                <Button variant="secondary" className="border-stone" asChild>
                  <Link href={`/club/${clubId}/staff`}>Invite staff</Link>
                </Button>
                <Button variant="secondary" className="border-stone" asChild>
                  <Link href={`/club/${clubId}/reports`}>View report</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
              <h3 className="font-display text-base text-ink">
                Today&apos;s utilisation
              </h3>
              <div className="mt-4 space-y-4">
                {courseUtils.map((c) => (
                  <UtilisationBar
                    key={c.id}
                    name={c.name}
                    pct={c.pct}
                    booked={c.booked}
                    total={c.total}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BookingDrawer
        bookingId={drawerId}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerId(null);
        }}
        onAfterChange={() => router.refresh()}
      />

      <AddBookingModal
        clubId={clubId}
        clubSlug={summary.slug}
        open={addOpen}
        onOpenChange={setAddOpen}
        dateStr={dateStr}
        courses={coursesMeta}
        initialSlot={addSlot}
        onSuccess={() => router.refresh()}
      />

      <BlockSlotModal
        clubId={clubId}
        open={blockOpen}
        onOpenChange={setBlockOpen}
        courses={coursesMeta}
        defaultCourseId={coursesMeta[0]?.id ?? ""}
        defaultDate={dateStr}
        onBlocked={() => router.refresh()}
      />

      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelId && cancelBooking(cancelId)}
            >
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatCard({
  label,
  value,
  borderClass,
  footer,
}: {
  label: string;
  value: string | number;
  borderClass: string;
  footer?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-stone bg-white p-4 shadow-sm border-t-2",
        borderClass
      )}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
      {footer}
    </div>
  );
}
