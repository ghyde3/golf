"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TeeTimeChipPicker } from "./TeeTimeChipPicker";
import type { TeeSlotRow } from "./types";

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BlockSlotModal({
  clubId,
  open,
  onOpenChange,
  courses,
  defaultCourseId,
  defaultDate,
  onBlocked,
}: {
  clubId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: { id: string; name: string }[];
  defaultCourseId: string;
  defaultDate: string;
  onBlocked: () => void;
}) {
  const [courseId, setCourseId] = useState(defaultCourseId);
  const [blockDate, setBlockDate] = useState(defaultDate);
  const [teesheet, setTeesheet] = useState<TeeSlotRow[]>([]);
  const [loadingTs, setLoadingTs] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<TeeSlotRow | null>(null);
  const [time, setTime] = useState("07:00");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCourseId(defaultCourseId);
      setBlockDate(defaultDate);
      setPickedSlot(null);
    }
  }, [open, defaultCourseId, defaultDate]);

  useEffect(() => {
    if (!open || !courseId) return;
    let cancelled = false;
    setLoadingTs(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/clubs/${clubId}/courses/${courseId}/teesheet?date=${encodeURIComponent(blockDate)}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("teesheet");
        const data = (await res.json()) as TeeSlotRow[];
        if (!cancelled) setTeesheet(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setTeesheet([]);
      } finally {
        if (!cancelled) setLoadingTs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clubId, courseId, blockDate]);

  const blockTimes = useMemo(() => {
    return [...teesheet].sort(
      (a, b) =>
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );
  }, [teesheet]);

  const slotDisabled = useCallback(
    (slot: TeeSlotRow) => {
      if (slot.status === "blocked") return true;
      const isToday = blockDate === todayIsoLocal();
      if (isToday && new Date(slot.datetime).getTime() <= Date.now()) {
        return true;
      }
      return false;
    },
    [blockDate]
  );

  async function submit() {
    let iso: string;
    if (pickedSlot) {
      iso = pickedSlot.datetime;
    } else {
      iso = new Date(`${blockDate}T${time}:00`).toISOString();
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/teesheet/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          courseId,
          datetime: iso,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      toast.success("Slot blocked");
      onBlocked();
      onOpenChange(false);
    } catch {
      toast.error("Could not block slot");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Block slot</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Course
            </label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-stone bg-warm-white px-3 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway focus-visible:ring-offset-2"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setPickedSlot(null);
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="block-slot-date"
              className="text-xs font-bold uppercase tracking-widest text-muted"
            >
              Date
            </label>
            <Input
              id="block-slot-date"
              className="mt-1"
              type="date"
              value={blockDate}
              onChange={(e) => {
                setBlockDate(e.target.value);
                setPickedSlot(null);
              }}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
              Time
            </label>
            <TeeTimeChipPicker
              times={blockTimes}
              selectedDatetime={pickedSlot?.datetime ?? null}
              onSelect={setPickedSlot}
              loading={loadingTs}
              emptyMessage="No tee sheet slots for this day. Use custom time below."
              disabled={slotDisabled}
            />
            <p className="mt-2 text-[11px] text-muted">
              Greyed-out times are already blocked or in the past.
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-stone bg-cream/40 px-3 py-3">
            <label
              htmlFor="block-slot-custom-time"
              className="text-xs font-bold uppercase tracking-widest text-muted"
            >
              Custom time
            </label>
            <p className="mb-2 text-[11px] text-muted">
              If you need a time not shown above (e.g. config just changed).
            </p>
            <Input
              id="block-slot-custom-time"
              className="font-mono text-sm tabular-nums"
              type="time"
              value={time}
              step={60}
              onChange={(e) => {
                setTime(e.target.value);
                setPickedSlot(null);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              submitting || (!pickedSlot && (!blockDate || !time))
            }
            onClick={submit}
          >
            {submitting ? "Blocking…" : "Block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
