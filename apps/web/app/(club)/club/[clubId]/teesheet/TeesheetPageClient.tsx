"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";
import { Button } from "@/components/ui/button";
import { AddBookingModal } from "@/components/teesheet/AddBookingModal";
import { BookingDrawer } from "@/components/teesheet/BookingDrawer";
import { BlockSlotModal } from "@/components/teesheet/BlockSlotModal";
import {
  BlockedSlotCell,
  BookingSlotChip,
  MissingSlotCell,
  OpenSlotCell,
} from "@/components/teesheet/SlotChip";
import type { TeeSlotRow } from "@/components/teesheet/types";
import { cn } from "@/lib/utils";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";
import { Ban, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

type Course = { id: string; name: string };

type Filter = "all" | "open" | "booked" | "upcoming";

type CourseWithSlots = { id: string; name: string; slots: TeeSlotRow[] };

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function slotMatchesFilter(
  slot: TeeSlotRow,
  filter: Filter,
  nowMs: number
): boolean {
  const t = new Date(slot.datetime).getTime();
  if (filter === "open") {
    return slot.status === "open" && slot.bookedPlayers === 0;
  }
  if (filter === "booked") {
    return slot.bookedPlayers > 0 && slot.status !== "blocked";
  }
  if (filter === "upcoming") {
    return t > nowMs;
  }
  return true;
}

function pctBooked(slots: TeeSlotRow[]): number {
  const total = slots.length;
  if (total === 0) return 0;
  const booked = slots.filter(
    (s) => s.bookedPlayers > 0 && s.status !== "blocked"
  ).length;
  return (booked / total) * 100;
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
  const [coursesWithSlots, setCoursesWithSlots] = useState<CourseWithSlots[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSlot, setAddSlot] = useState<TeeSlotRow | null>(null);
  const [addCourseId, setAddCourseId] = useState<string>("");
  const [blockOpen, setBlockOpen] = useState(false);

  /** First teesheet fetch shows the full-page loader; later refreshes (date change, etc.) stay silent. */
  const teesheetInitialLoadRef = useRef(true);

  useEffect(() => {
    teesheetInitialLoadRef.current = true;
  }, [clubId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const loadCourses = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/courses`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as Course[];
    setCourses(data);
  }, [clubId]);

  const loadAllTeesheets = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (courses.length === 0) {
        setCoursesWithSlots([]);
        return;
      }
      const silent = opts?.silent === true;
      if (!silent) {
        setLoading(true);
      }
      try {
        const results = await Promise.all(
          courses.map(async (c) => {
            const res = await fetch(
              `/api/clubs/${clubId}/courses/${c.id}/teesheet?date=${encodeURIComponent(dateStr)}`,
              { credentials: "include" }
            );
            if (!res.ok) throw new Error("teesheet");
            const data = (await res.json()) as TeeSlotRow[];
            return {
              id: c.id,
              name: c.name,
              slots: Array.isArray(data) ? data : [],
            };
          })
        );
        setCoursesWithSlots(results);
        setUpdatedAt(Date.now());
      } catch {
        toast.error("Could not load tee sheet");
        if (!silent) {
          setCoursesWithSlots([]);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [clubId, courses, dateStr]
  );

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (courses.length === 0) return;
    const silent = !teesheetInitialLoadRef.current;
    teesheetInitialLoadRef.current = false;
    loadAllTeesheets({ silent });
  }, [courses, loadAllTeesheets]);

  useEffect(() => {
    const t = setInterval(() => {
      loadAllTeesheets({ silent: true });
    }, 60_000);
    return () => clearInterval(t);
  }, [loadAllTeesheets]);

  const nowMs = Date.now();

  const slotMaps = useMemo(() => {
    const out: Record<string, Map<string, TeeSlotRow>> = {};
    for (const c of coursesWithSlots) {
      const m = new Map<string, TeeSlotRow>();
      for (const s of c.slots) {
        m.set(s.datetime, s);
      }
      out[c.id] = m;
    }
    return out;
  }, [coursesWithSlots]);

  const timeKeys = useMemo(() => {
    const set = new Set<string>();
    for (const c of coursesWithSlots) {
      for (const s of c.slots) {
        set.add(s.datetime);
      }
    }
    return [...set].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
  }, [coursesWithSlots]);

  const visibleTimeKeys = useMemo(() => {
    return timeKeys.filter((ts) => {
      return coursesWithSlots.some((c) => {
        const slot = slotMaps[c.id]?.get(ts);
        if (!slot) return false;
        return slotMatchesFilter(slot, filter, nowMs);
      });
    });
  }, [timeKeys, coursesWithSlots, slotMaps, filter, nowMs]);

  const firstUpcomingVisibleIdx = visibleTimeKeys.findIndex(
    (ts) => new Date(ts).getTime() > nowMs
  );

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const drag = active.data.current as
        | {
            type: string;
            bookingId: string;
            sourceSlotId: string | null;
            playersCount: number;
          }
        | undefined;
      const drop = over.data.current as
        | { type: string; teeSlotId: string | null; courseId: string }
        | undefined;

      if (!drag || drag.type !== "booking" || !drop || drop.type !== "slot") {
        return;
      }
      if (!drop.teeSlotId || !drag.sourceSlotId) {
        toast.error("Cannot move to this slot");
        return;
      }
      if (drop.teeSlotId === drag.sourceSlotId) {
        return;
      }

      try {
        const res = await fetch(`/api/bookings/${drag.bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ teeSlotId: drop.teeSlotId }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            typeof err.error === "string" ? err.error : "Move failed"
          );
        }
        toast.success("Booking moved");
        loadAllTeesheets({ silent: true });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not move booking"
        );
      }
    },
    [loadAllTeesheets]
  );

  const secs = Math.floor((Date.now() - updatedAt) / 1000);

  const nCols = Math.max(1, coursesWithSlots.length);

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
                setAddCourseId(coursesWithSlots[0]?.id ?? "");
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
            <span className="text-xs text-muted">Updated {secs}s ago</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-warm-white">
          {loading ? (
            <p className="p-6 text-muted">Loading…</p>
          ) : coursesWithSlots.length === 0 ? (
            <p className="p-6 text-muted">No courses configured.</p>
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div className="min-w-[min(100%,520px)] px-4 pb-6 pt-2 lg:min-w-[720px]">
                <div
                  className="grid gap-x-2 gap-y-0"
                  style={{
                    gridTemplateColumns: `72px repeat(${nCols}, minmax(120px, 1fr))`,
                  }}
                >
                  <div className="sticky left-0 z-30 border-b border-stone bg-cream/80 px-1 py-2 text-[10px] font-bold uppercase tracking-widest text-muted backdrop-blur-sm" />
                  {coursesWithSlots.map((c) => {
                    const pct = pctBooked(c.slots);
                    return (
                      <div
                        key={c.id}
                        className="sticky top-0 z-20 border-b border-stone bg-cream/80 px-2 py-2 text-center backdrop-blur-sm"
                      >
                        <div className="text-xs font-bold text-ink">
                          {c.name}
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted tabular-nums">
                          {Math.round(pct)}% booked
                        </div>
                      </div>
                    );
                  })}

                  {visibleTimeKeys.map((ts, rowIdx) => {
                    const rowPast = new Date(ts).getTime() < nowMs;
                    return (
                      <Fragment key={ts}>
                        {firstUpcomingVisibleIdx === rowIdx ? (
                          <div className="contents">
                            <div
                              className="col-span-full flex items-center gap-2 border-b border-green-200 bg-green-50 px-4 py-1.5"
                              style={{ gridColumn: "1 / -1" }}
                            >
                              <div className="h-2 w-2 rounded-full bg-grass" />
                              <span className="text-xs font-bold text-green-700">
                                Now
                              </span>
                              <span className="font-mono text-xs text-green-700">
                                {format(new Date(), "h:mm a")}
                              </span>
                            </div>
                          </div>
                        ) : null}

                        <div className="contents">
                          <div
                            className={cn(
                              "sticky left-0 z-10 flex items-start border-b border-stone/60 bg-warm-white py-2 pl-1 pr-2 font-mono text-[11px] tabular-nums text-ink",
                              rowPast && "text-muted"
                            )}
                          >
                            {format(new Date(ts), "h:mm a")}
                          </div>

                          {coursesWithSlots.map((c) => {
                            const slot = slotMaps[c.id]?.get(ts);
                            if (!slot) {
                              return (
                                <div
                                  key={`${c.id}-${ts}`}
                                  className="border-b border-stone/60 py-1"
                                >
                                  <MissingSlotCell isPast={rowPast} />
                                </div>
                              );
                            }

                            const isBlocked = slot.status === "blocked";
                            const isBooked =
                              slot.bookedPlayers > 0 &&
                              slot.status !== "blocked" &&
                              !!slot.bookingId;

                            if (isBlocked) {
                              return (
                                <div
                                  key={`${c.id}-${ts}`}
                                  className="border-b border-stone/60 py-1"
                                >
                                  <BlockedSlotCell isPast={rowPast} />
                                </div>
                              );
                            }

                            if (isBooked && slot.bookingId) {
                              return (
                                <div
                                  key={`${c.id}-${ts}`}
                                  className="border-b border-stone/60 py-1"
                                >
                                  <BookingSlotChip
                                    slot={slot}
                                    isPast={rowPast}
                                    onOpenBooking={() => {
                                      setDrawerId(slot.bookingId!);
                                      setDrawerOpen(true);
                                    }}
                                  />
                                </div>
                              );
                            }

                            if (
                              slot.bookedPlayers > 0 &&
                              slot.status !== "blocked" &&
                              !slot.bookingId
                            ) {
                              return (
                                <div
                                  key={`${c.id}-${ts}`}
                                  className="border-b border-stone/60 py-1"
                                >
                                  <div className="flex min-h-[52px] items-center rounded-md border border-stone bg-cream/50 px-2 text-xs text-muted">
                                    Booked (no ref)
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={`${c.id}-${ts}`}
                                className="border-b border-stone/60 py-1"
                              >
                                <OpenSlotCell
                                  slot={slot}
                                  isPast={rowPast}
                                  courseId={c.id}
                                  datetimeIso={ts}
                                  onBook={() => {
                                    setAddSlot(slot);
                                    setAddCourseId(c.id);
                                    setAddOpen(true);
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            </DndContext>
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
        onAfterChange={() => loadAllTeesheets({ silent: true })}
      />

      <AddBookingModal
        clubId={clubId}
        clubSlug={clubSlug}
        open={addOpen}
        onOpenChange={setAddOpen}
        dateStr={dateStr}
        courses={courses}
        initialSlot={addSlot}
        initialCourseId={addCourseId || undefined}
        onSuccess={() => loadAllTeesheets({ silent: true })}
      />

      <BlockSlotModal
        clubId={clubId}
        open={blockOpen}
        onOpenChange={setBlockOpen}
        courses={courses}
        defaultCourseId={coursesWithSlots[0]?.id || courses[0]?.id || ""}
        defaultDate={dateStr}
        onBlocked={() => loadAllTeesheets({ silent: true })}
      />
    </>
  );
}
