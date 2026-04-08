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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TeeTimeChipPicker } from "./TeeTimeChipPicker";
import type { TeeSlotRow } from "./types";

type StaffAddonItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  sortOrder: number;
  unitsConsumed: number;
  resourceTypeId: string | null;
  active?: boolean;
};

function maxStaffAddonQty(a: StaffAddonItem): number {
  return a.unitsConsumed === 1 ? 4 : 1;
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pickableSlots(
  slots: TeeSlotRow[],
  playersCount: number,
  pickerDateYmd: string
): TeeSlotRow[] {
  const now = Date.now();
  const isToday = pickerDateYmd === todayIsoLocal();
  return slots
    .filter((s) => {
      if (s.status !== "open") return false;
      if (s.bookedPlayers + playersCount > s.maxPlayers) return false;
      const t = new Date(s.datetime).getTime();
      if (isToday && t <= now) return false;
      return true;
    })
    .sort(
      (a, b) =>
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );
}

export function AddBookingModal({
  clubId,
  clubSlug,
  open,
  onOpenChange,
  dateStr,
  courses,
  initialSlot,
  initialCourseId,
  onSuccess,
}: {
  clubId: string;
  clubSlug: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dateStr: string;
  courses: { id: string; name: string }[];
  initialSlot: TeeSlotRow | null;
  /** When opening "Add booking", pre-select this course in the picker */
  initialCourseId?: string;
  onSuccess: () => void;
}) {
  const modeA = initialSlot != null;
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [pickerDate, setPickerDate] = useState(dateStr);
  const [teesheet, setTeesheet] = useState<TeeSlotRow[]>([]);
  const [pickedSlot, setPickedSlot] = useState<TeeSlotRow | null>(
    initialSlot
  );
  const [loadingTs, setLoadingTs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [players, setPlayers] = useState(2);
  const [addonCatalog, setAddonCatalog] = useState<StaffAddonItem[]>([]);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      setPickedSlot(initialSlot);
      setError(null);
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setPlayers(2);
      setCourseId(
        initialCourseId && courses.some((c) => c.id === initialCourseId)
          ? initialCourseId
          : (courses[0]?.id ?? "")
      );
      setPickerDate(dateStr);
      setAddonQty({});
    }
  }, [open, initialSlot, courses, dateStr, initialCourseId]);

  useEffect(() => {
    if (!open || !clubId) return;
    let cancelled = false;
    fetch(`/api/clubs/${clubId}/addons`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: StaffAddonItem[]) => {
        if (!cancelled && Array.isArray(data)) {
          const activeOnly = data.filter((a: StaffAddonItem) => a.active !== false);
          setAddonCatalog(activeOnly);
          const init: Record<string, number> = {};
          for (const a of activeOnly) init[a.id] = 0;
          setAddonQty((prev) => ({ ...init, ...prev }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, clubId]);

  useEffect(() => {
    if (!open || modeA || !courseId) return;
    let cancelled = false;
    setLoadingTs(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/clubs/${clubId}/courses/${courseId}/teesheet?date=${encodeURIComponent(pickerDate)}`,
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
  }, [open, modeA, clubId, courseId, pickerDate]);

  const times = useMemo(
    () => pickableSlots(teesheet, players, pickerDate),
    [teesheet, players, pickerDate]
  );

  const buildAddOnsPayload = useCallback(() => {
    const out: { addonCatalogId: string; quantity: number }[] = [];
    for (const a of addonCatalog) {
      const q = addonQty[a.id] ?? 0;
      if (q > 0) out.push({ addonCatalogId: a.id, quantity: q });
    }
    return out;
  }, [addonCatalog, addonQty]);

  useEffect(() => {
    if (!modeA && pickedSlot && times.length > 0) {
      const still = times.some((t) => t.datetime === pickedSlot.datetime);
      if (!still) setPickedSlot(null);
    }
  }, [times, pickedSlot, modeA]);

  const submit = useCallback(async () => {
    const slot = modeA ? initialSlot : pickedSlot;
    if (!slot) {
      setError("Choose a date, course, and tee time.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const addOns = buildAddOnsPayload();
      if (slot.id) {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            teeSlotId: slot.id,
            playersCount: players,
            guestName: name.trim(),
            guestEmail: email.trim(),
            notes: notes.trim() || undefined,
            ...(addOns.length > 0 ? { addOns } : {}),
          }),
        });
        const raw = await res.text();
        if (res.status === 409) {
          try {
            const j = JSON.parse(raw) as { code?: string };
            if (j.code === "ADDON_UNAVAILABLE") {
              setError("An add-on is not available for this time.");
            } else {
              setError("This slot just filled — choose another time");
            }
          } catch {
            setError("This slot just filled — choose another time");
          }
          setSubmitting(false);
          return;
        }
        if (!res.ok) {
          setError(raw || "Could not create booking");
          setSubmitting(false);
          return;
        }
        const data = JSON.parse(raw) as { bookingRef?: string };
        toast.success(
          `Booking confirmed — ${data.bookingRef ?? "ref pending"}`
        );
      } else {
        const res = await fetch("/api/bookings/public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            courseId,
            datetime: slot.datetime,
            clubSlug,
            playersCount: players,
            guestName: name.trim(),
            guestEmail: email.trim(),
            notes: notes.trim() || undefined,
            ...(addOns.length > 0 ? { addOns } : {}),
          }),
        });
        const raw = await res.text();
        if (res.status === 409) {
          try {
            const j = JSON.parse(raw) as { code?: string };
            if (j.code === "ADDON_UNAVAILABLE") {
              setError("An add-on is not available for this time.");
            } else {
              setError("This slot just filled — choose another time");
            }
          } catch {
            setError("This slot just filled — choose another time");
          }
          setSubmitting(false);
          return;
        }
        if (!res.ok) {
          setError(raw || "Could not create booking");
          setSubmitting(false);
          return;
        }
        const data = JSON.parse(raw) as { bookingRef?: string };
        toast.success(
          `Booking confirmed — ${data.bookingRef ?? "ref pending"}`
        );
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }, [
    modeA,
    initialSlot,
    pickedSlot,
    courseId,
    clubSlug,
    name,
    email,
    notes,
    players,
    onOpenChange,
    onSuccess,
    buildAddOnsPayload,
  ]);

  const slotForCard = modeA ? initialSlot : pickedSlot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
        </DialogHeader>

        {slotForCard ? (
          <div className="rounded-xl bg-forest p-4 text-white">
            <p className="font-mono text-2xl font-medium">
              {format(new Date(slotForCard.datetime), "h:mm a")}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {format(new Date(slotForCard.datetime), "MMM d, yyyy")}
            </p>
          </div>
        ) : null}

        {!modeA ? (
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
                htmlFor="add-booking-date"
                className="text-xs font-bold uppercase tracking-widest text-muted"
              >
                Date
              </label>
              <Input
                id="add-booking-date"
                className="mt-1"
                type="date"
                value={pickerDate}
                onChange={(e) => {
                  setPickerDate(e.target.value);
                  setPickedSlot(null);
                }}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
                Tee time
              </label>
              <TeeTimeChipPicker
                times={times}
                selectedDatetime={pickedSlot?.datetime ?? null}
                onSelect={setPickedSlot}
                loading={loadingTs}
                emptyMessage="No open tee times for this date and party size. Try another date or fewer players."
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Full name
            </label>
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Email
            </label>
            <Input
              className="mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Phone (optional)
            </label>
            <Input
              className="mt-1"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Players
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="border-stone"
                disabled={players <= 1}
                onClick={() => setPlayers((p) => Math.max(1, p - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-mono text-sm">{players}</span>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="border-stone"
                disabled={players >= 4}
                onClick={() => setPlayers((p) => Math.min(4, p + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {addonCatalog.length > 0 ? (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                Add-ons
              </label>
              <ul className="mt-2 space-y-2 rounded-lg border border-stone bg-white p-2">
                {addonCatalog.map((a) => {
                  const q = addonQty[a.id] ?? 0;
                  const maxQ = maxStaffAddonQty(a);
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {a.name}{" "}
                        <span className="text-muted">
                          (${(a.priceCents / 100).toFixed(0)})
                        </span>
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7 border-stone"
                          disabled={q <= 0}
                          onClick={() =>
                            setAddonQty((prev) => ({
                              ...prev,
                              [a.id]: Math.max(0, (prev[a.id] ?? 0) - 1),
                            }))
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-5 text-center font-mono text-xs">{q}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7 border-stone"
                          disabled={q >= maxQ}
                          onClick={() =>
                            setAddonQty((prev) => ({
                              ...prev,
                              [a.id]: Math.min(maxQ, (prev[a.id] ?? 0) + 1),
                            }))
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Notes
            </label>
            <Input
              className="mt-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting}
            onClick={submit}
            className={cn(submitting && "opacity-80")}
          >
            {submitting ? "Saving…" : "Confirm booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
