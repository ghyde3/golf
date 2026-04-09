"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Props {
  booking: {
    id: string;
    bookingRef: string;
    playersCount: number;
    teeSlot: {
      datetime: string;
      courseName: string;
      clubName: string;
    };
  };
  accessToken: string;
  onModified: () => void;
  trigger: ReactNode;
}

function formatSubheading(iso: string): string {
  const d = new Date(iso);
  const dateLabel = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return dateLabel;
}

export function ModifyBookingModal({
  booking,
  accessToken,
  onModified,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [playersCount, setPlayersCount] = useState(booking.playersCount);
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPlayersCount(booking.playersCount);
    setInlineError(null);
  }, [open, booking.playersCount]);

  async function handleSave() {
    setInlineError(null);
    const token = accessToken.trim();
    if (!token) {
      setInlineError("Sign in to modify this booking.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playersCount }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
      };

      if (res.ok) {
        onModified();
        setOpen(false);
        toast.success("Booking updated");
        return;
      }

      if (res.status === 403 && body.code === "OUTSIDE_WINDOW") {
        setInlineError(
          "This booking can no longer be modified (outside cancellation window)."
        );
        return;
      }

      if (res.status === 409 && body.code === "SLOT_FULL") {
        setInlineError("Not enough capacity for this player count.");
        return;
      }

      setInlineError(
        typeof body.error === "string"
          ? body.error
          : "Could not update booking."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function bump(delta: number) {
    setPlayersCount((c) => Math.min(4, Math.max(1, c + delta)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={cn(
          "max-w-md border-ds-stone bg-warm-white p-5 sm:p-6"
        )}
      >
        <DialogTitle className="pr-8 font-display text-ds-forest">
          Modify booking
        </DialogTitle>
        <DialogDescription asChild>
          <div className="text-sm text-ds-muted">
            <p>
              {formatSubheading(booking.teeSlot.datetime)}
              <span className="text-ds-stone"> · </span>
              {booking.teeSlot.courseName}
            </p>
            <p className="mt-0.5">{booking.teeSlot.clubName}</p>
            <p className="mt-0.5 font-mono text-xs text-ds-muted">
              {booking.bookingRef}
            </p>
          </div>
        </DialogDescription>

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
            Players
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-ds-stone"
              disabled={submitting || playersCount <= 1}
              onClick={() => bump(-1)}
              aria-label="Decrease players"
            >
              −
            </Button>
            <span className="min-w-[2ch] text-center font-display text-2xl tabular-nums text-ds-ink">
              {playersCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-ds-stone"
              disabled={submitting || playersCount >= 4}
              onClick={() => bump(1)}
              aria-label="Increase players"
            >
              +
            </Button>
          </div>
        </div>

        {inlineError && (
          <p className="mt-4 text-sm text-amber-800" role="alert">
            {inlineError}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-ds-fairway hover:bg-ds-fairway/90"
            disabled={submitting}
            onClick={() => void handleSave()}
          >
            {submitting ? "Saving…" : "Save changes"}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="border-ds-stone">
              Cancel
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
