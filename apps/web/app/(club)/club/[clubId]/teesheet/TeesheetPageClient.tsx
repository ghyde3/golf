"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";
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
import { Button } from "@/components/ui/button";
import { AddBookingModal } from "@/components/teesheet/AddBookingModal";
import { BookingDrawer } from "@/components/teesheet/BookingDrawer";
import { BlockSlotModal } from "@/components/teesheet/BlockSlotModal";
import { SlotRow } from "@/components/teesheet/SlotRow";
import type { TeeSlotRow } from "@/components/teesheet/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Ban, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Course = { id: string; name: string };

type Filter = "all" | "open" | "booked" | "upcoming";

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TeesheetPageClient({
  clubId,
  clubSlug,
}: {
  clubId: string;
  clubSlug: string;
}) {
  const searchParams = useSearchParams();
  const dateStr = searchParams.get("date") ?? todayIsoLocal();

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [slots, setSlots] = useState<TeeSlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSlot, setAddSlot] = useState<TeeSlotRow | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/courses`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as Course[];
    setCourses(data);
    setCourseId((prev) => prev || data[0]?.id || "");
  }, [clubId]);

  const loadTeesheet = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/courses/${courseId}/teesheet?date=${encodeURIComponent(dateStr)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("teesheet");
      const data = (await res.json()) as TeeSlotRow[];
      setSlots(Array.isArray(data) ? data : []);
      setUpdatedAt(Date.now());
    } catch {
      toast.error("Could not load tee sheet");
    } finally {
      setLoading(false);
    }
  }, [clubId, courseId, dateStr]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (courseId) loadTeesheet();
  }, [courseId, loadTeesheet]);

  useEffect(() => {
    const t = setInterval(() => {
      loadTeesheet();
    }, 60_000);
    return () => clearInterval(t);
  }, [loadTeesheet]);

  const nowMs = Date.now();

  const filtered = useMemo(() => {
    return slots.filter((s) => {
      const t = new Date(s.datetime).getTime();
      if (filter === "open") {
        return s.status === "open" && s.bookedPlayers === 0;
      }
      if (filter === "booked") {
        return s.bookedPlayers > 0 && s.status !== "blocked";
      }
      if (filter === "upcoming") {
        return t > nowMs;
      }
      return true;
    });
  }, [slots, filter, nowMs]);

  const firstUpcomingIdx = filtered.findIndex(
    (s) => new Date(s.datetime).getTime() > nowMs
  );

  const courseUtils = useMemo(() => {
    return courses.map((c) => {
      if (c.id !== courseId) {
        return { ...c, pct: 0, full: false };
      }
      const total = slots.length;
      const booked = slots.filter(
        (s) => s.bookedPlayers > 0 && s.status !== "blocked"
      ).length;
      const pct = total === 0 ? 0 : (booked / total) * 100;
      return { ...c, pct, full: pct >= 100 && total > 0 };
    });
  }, [courses, courseId, slots]);

  async function cancelBooking(id: string) {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("x");
      toast.success("Booking cancelled");
      setCancelId(null);
      loadTeesheet();
    } catch {
      toast.error("Could not cancel");
    }
  }

  const secs = Math.floor((Date.now() - updatedAt) / 1000);

  return (
    <>
      <SetTopBar
        title="Tee sheet"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="border-stone"
              onClick={() => setBlockOpen(true)}
            >
              <Ban className="mr-1 h-4 w-4 lg:mr-1" />
              <span className="hidden sm:inline">Block slot</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setAddSlot(null);
                setAddOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Add booking</span>
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-stone bg-warm-white px-6 py-3">
          <div className="flex flex-wrap gap-4">
            {courseUtils.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={c.full}
                onClick={() => setCourseId(c.id)}
                className={cn(
                  "border-b-2 pb-1 text-sm transition-colors",
                  c.id === courseId
                    ? "border-fairway font-semibold text-fairway"
                    : c.full
                      ? "cursor-not-allowed border-transparent text-muted"
                      : "border-transparent text-muted hover:text-ink"
                )}
              >
                {c.name}
                {c.full ? " — full" : ""}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {(["all", "open", "booked", "upcoming"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium capitalize",
                  filter === f
                    ? "bg-ink text-white"
                    : "bg-cream text-muted hover:bg-stone/80"
                )}
              >
                {f}
              </button>
            ))}
            <span className="text-xs text-muted">
              Updated {secs}s ago
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-warm-white">
          {loading ? (
            <p className="p-6 text-muted">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-[80px_1fr_110px_100px_120px_110px] border-b border-stone bg-cream/50 px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted lg:grid-cols-[80px_1fr_110px_100px_120px_110px]">
                <span>Time</span>
                <span>Guest</span>
                <span>Players</span>
                <span className="hidden lg:block">Price</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              {filtered.map((slot, i) => (
                <div key={slot.datetime + String(i)}>
                  {firstUpcomingIdx === i ? (
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-green-200 bg-green-50 px-6 py-1.5">
                      <div className="h-2 w-2 rounded-full bg-grass" />
                      <span className="text-xs font-bold text-green-700">
                        Now
                      </span>
                      <span className="font-mono text-xs text-green-700">
                        {format(new Date(), "h:mm a")}
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
            </>
          )}
        </div>
      </div>

      <BookingDrawer
        bookingId={drawerId}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerId(null);
        }}
        onAfterChange={loadTeesheet}
      />

      <AddBookingModal
        clubId={clubId}
        clubSlug={clubSlug}
        open={addOpen}
        onOpenChange={setAddOpen}
        dateStr={dateStr}
        courses={courses}
        initialSlot={addSlot}
        onSuccess={() => loadTeesheet()}
      />

      <BlockSlotModal
        clubId={clubId}
        open={blockOpen}
        onOpenChange={setBlockOpen}
        courses={courses}
        defaultCourseId={courseId || courses[0]?.id || ""}
        defaultDate={dateStr}
        onBlocked={loadTeesheet}
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
              className="bg-red-600 hover:bg-red-600/90"
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
