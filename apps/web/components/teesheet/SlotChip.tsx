"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Ban, Check, Plus } from "lucide-react";
import type { TeeSlotRow } from "./types";

export function formatGuestShort(
  guestName: string | null | undefined,
  bookingRef: string | null | undefined
): string {
  if (guestName && guestName.trim()) {
    const parts = guestName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].length > 18
        ? `${parts[0].slice(0, 16)}…`
        : parts[0];
    }
    const first = parts[0][0]?.toUpperCase() ?? "?";
    const last = parts[parts.length - 1];
    return `${first}. ${last}`;
  }
  return bookingRef?.trim() || "Guest";
}

function PlayerDots({
  booked,
  max,
}: {
  booked: number;
  max: number;
}) {
  const n = Math.min(Math.max(max, 1), 4);
  const filled = Math.min(Math.max(booked, 0), n);
  return (
    <span
      className="inline-flex gap-0.5"
      aria-label={`${booked} of ${max} players`}
    >
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i < filled ? "bg-fairway" : "border border-stone bg-transparent"
          )}
        />
      ))}
    </span>
  );
}

export function BookingSlotChip({
  slot,
  isPast,
  onOpenBooking,
}: {
  slot: TeeSlotRow;
  isPast: boolean;
  onOpenBooking: () => void;
}) {
  const playersCount =
    slot.bookingPlayersCount ?? slot.bookedPlayers ?? 0;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `booking-drag-${slot.bookingId}`,
      data: {
        type: "booking" as const,
        bookingId: slot.bookingId as string,
        playersCount,
        sourceSlotId: slot.id,
      },
      disabled: !slot.bookingId || !slot.id,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const label = formatGuestShort(slot.guestName, slot.bookingRef);

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onOpenBooking();
      }}
      className={cn(
        "flex w-full min-w-0 flex-col gap-0.5 rounded-lg border border-stone bg-white px-2 py-1.5 text-left shadow-sm transition-shadow",
        "border-l-4 border-l-fairway",
        isPast && "opacity-50",
        isDragging && "z-50 cursor-grabbing opacity-90 shadow-lg ring-2 ring-fairway/40",
        !isDragging && "cursor-grab hover:bg-cream/80"
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-1">
        <span className="truncate text-sm font-semibold leading-tight text-ink">
          {label}
        </span>
        <Check
          className="h-4 w-4 shrink-0 text-fairway"
          strokeWidth={2.5}
          aria-hidden
        />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-1">
        <span className="truncate font-mono text-[10px] text-muted tabular-nums">
          {slot.bookingRef ?? "—"}
        </span>
        <PlayerDots booked={playersCount} max={slot.maxPlayers} />
      </div>
    </button>
  );
}

export function OpenSlotCell({
  slot,
  isPast,
  courseId,
  datetimeIso,
  onBook,
}: {
  slot: TeeSlotRow;
  isPast: boolean;
  courseId: string;
  datetimeIso: string;
  onBook: () => void;
}) {
  const droppable =
    slot.id && slot.status === "open";

  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${courseId}-${datetimeIso}-${slot.id ?? "x"}`,
    data: {
      type: "slot" as const,
      teeSlotId: slot.id,
      courseId,
    },
    disabled: !droppable,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex min-h-[52px] items-center justify-center rounded-md border border-dashed border-stone/60 bg-cream/30 px-1 py-1 transition-colors duration-150",
        isPast && "opacity-40",
        !isPast &&
          droppable &&
          "hover:border-fairway hover:bg-emerald-50/90 hover:ring-2 hover:ring-fairway/25",
        isOver &&
          droppable &&
          "border-emerald-600 bg-emerald-50 shadow-sm ring-2 ring-fairway/40"
      )}
    >
      {!isPast && slot.id ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBook();
          }}
          className="flex h-8 w-full items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-white/80 hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
          aria-label="Book this slot"
        >
          <Plus className="h-4 w-4" />
        </button>
      ) : (
        <span className="text-[10px] text-muted">—</span>
      )}
    </div>
  );
}

export function BlockedSlotCell({ isPast }: { isPast: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-[52px] items-center justify-center gap-1.5 rounded-md border-2 border-amber-900/50 bg-amber-100/90 bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,rgba(180,83,9,0.14)_5px,rgba(180,83,9,0.14)_10px)] px-2 py-1.5 text-center shadow-sm",
        isPast && "opacity-45"
      )}
    >
      <Ban className="h-3.5 w-3.5 shrink-0 text-amber-900" aria-hidden />
      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-950">
        Blocked
      </span>
    </div>
  );
}

export function MissingSlotCell({ isPast }: { isPast: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-[52px] items-center justify-center rounded-md border border-transparent bg-transparent text-[10px] text-muted/50",
        isPast && "opacity-40"
      )}
    >
      —
    </div>
  );
}
