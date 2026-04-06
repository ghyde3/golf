"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge, type SlotStatus } from "@/components/ui/StatusBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Check, Plus, X } from "lucide-react";
import { format } from "date-fns";
import type { TeeSlotRow } from "./types";

function slotBadgeStatus(slot: TeeSlotRow): SlotStatus {
  if (slot.status === "blocked") return "blocked";
  if (slot.bookedPlayers > 0) return "confirmed";
  return "open";
}

function formatPrice(p: number | null): string {
  if (p == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(p);
}

export function SlotRow({
  slot,
  nowMs,
  onRowClick,
  onBook,
  onCheckIn,
  onCancel,
}: {
  slot: TeeSlotRow;
  nowMs: number;
  onRowClick?: () => void;
  onBook?: () => void;
  onCheckIn?: () => void;
  onCancel?: () => void;
}) {
  const t = new Date(slot.datetime).getTime();
  const isPast = t < nowMs;
  const iconOnly = useMediaQuery("(max-width: 1023px)");

  const isBooked = slot.bookedPlayers > 0 && slot.status !== "blocked";
  const isOpen =
    slot.status === "open" && slot.bookedPlayers === 0;
  const isBlocked = slot.status === "blocked";

  const guestLabel =
    slot.bookingRef ??
    (isOpen ? "—" : isBlocked ? "—" : "Guest");

  return (
      <div
        role={isBooked && onRowClick ? "button" : undefined}
        tabIndex={isBooked && onRowClick ? 0 : undefined}
        onClick={isBooked && onRowClick ? onRowClick : undefined}
        onKeyDown={
          isBooked && onRowClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick();
                }
              }
            : undefined
        }
        className={cn(
          "grid items-center gap-2 border-b border-stone/80 px-6 py-2.5 text-sm",
          "grid-cols-[80px_1fr_110px_120px_110px] lg:grid-cols-[80px_1fr_110px_100px_120px_110px]",
          isPast && !isBlocked && "opacity-40",
          isBooked && onRowClick && "cursor-pointer hover:bg-cream/80"
        )}
      >
        <span className="font-mono text-xs text-ink tabular-nums">
          {format(new Date(slot.datetime), "h:mm a")}
        </span>
        <span className="min-w-0 truncate text-ink">{guestLabel}</span>
        <span className="font-mono text-xs text-muted tabular-nums">
          {slot.bookedPlayers}/{slot.maxPlayers}
        </span>
        <span className="hidden font-mono text-xs text-muted tabular-nums lg:block">
          {formatPrice(slot.price)}
        </span>
        <div>
          <StatusBadge status={slotBadgeStatus(slot)} />
        </div>
        <div className="flex justify-end gap-1">
          {isOpen && onBook ? (
            iconOnly ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="border-stone"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBook();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Book</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="border-stone"
                onClick={(e) => {
                  e.stopPropagation();
                  onBook();
                }}
              >
                Book
              </Button>
            )
          ) : null}
          {isBooked && !isBlocked && onCheckIn && onCancel ? (
            iconOnly ? (
              <>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="border-stone"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCheckIn();
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Check in</TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="border-stone"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancel();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel booking</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="border-stone"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckIn();
                  }}
                >
                  Check in
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-stone"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                >
                  Cancel
                </Button>
              </>
            )
          ) : null}
        </div>
      </div>
  );
}
