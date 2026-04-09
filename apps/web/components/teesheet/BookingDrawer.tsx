"use client";

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
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { BookingDetail } from "./types";
import { BookingDrawerAddons } from "./BookingDrawerAddons";

function fmtTeeClock(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

function fmtTeeCalendar(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

function fmtBookedAt(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

export function BookingDrawer({
  bookingId,
  open,
  onClose,
  onAfterChange,
  timeZone,
}: {
  bookingId: string | null;
  open: boolean;
  onClose: () => void;
  onAfterChange: () => void;
  /** When set (e.g. club config), times render in this zone with no offset label. */
  timeZone?: string;
}) {
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [changedPlayers, setChangedPlayers] = useState<Set<string>>(
    () => new Set()
  );
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const isTablet = useMediaQuery("(max-width: 1023px)");

  const reloadBooking = useCallback(async () => {
    if (!bookingId) return;
    const res = await fetch(`/api/bookings/${bookingId}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as BookingDetail;
    setDetail(data);
  }, [bookingId]);

  useEffect(() => {
    if (!open || !bookingId) {
      setDetail(null);
      setChangedPlayers(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as BookingDetail;
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) toast.error("Could not load booking");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const patchPlayer = useCallback(
    async (
      playerId: string,
      body: { checkedIn?: boolean; noShow?: boolean }
    ) => {
      if (!bookingId) return;
      setPending((p) => new Set(p).add(playerId));
      const prev = detail;
      if (detail) {
        setDetail({
          ...detail,
          players: detail.players.map((pl) =>
            pl.id === playerId
              ? {
                  ...pl,
                  checkedIn: body.checkedIn ?? pl.checkedIn,
                  noShow: body.noShow ?? pl.noShow,
                }
              : pl
          ),
        });
      }
      try {
        const res = await fetch(
          `/api/bookings/${bookingId}/players/${playerId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) throw new Error("patch failed");
        setChangedPlayers((c) => new Set(c).add(playerId));
        onAfterChange();
      } catch {
        toast.error("Could not update player");
        setDetail(prev);
      } finally {
        setPending((p) => {
          const n = new Set(p);
          n.delete(playerId);
          return n;
        });
      }
    },
    [bookingId, detail, onAfterChange]
  );

  const onCancelBooking = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Booking cancelled");
      setCancelOpen(false);
      onClose();
      onAfterChange();
    } catch {
      toast.error("Could not cancel booking");
    }
  }, [bookingId, onAfterChange, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30"
        aria-label="Close panel"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full overflow-y-auto border-l border-stone bg-warm-white shadow-xl transition-transform duration-200 ease-out",
          isTablet ? "w-full" : "w-[400px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-stone px-4 py-3">
          <h2 className="font-display text-lg text-ink">Booking</h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-muted"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4">
          {loading || !detail ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <>
              <div className="rounded-xl bg-forest p-4 text-white shadow-inner">
                <p className="font-mono text-3xl font-medium leading-tight">
                  {fmtTeeClock(detail.teeSlot.datetime, timeZone)}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {detail.teeSlot.courseName} ·{" "}
                  {fmtTeeCalendar(detail.teeSlot.datetime, timeZone)} ·{" "}
                  {detail.playersCount} players
                </p>
                <p className="mt-3 font-mono text-sm text-gold-light">
                  {detail.bookingRef}
                </p>
                <p className="mt-2">
                  <span className="inline-flex rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-medium text-white/75">
                    {detail.source === "staff" ? "Staff entry" : "Online"}
                  </span>
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
                  Guest
                </h3>
                <p className="text-ink">{detail.guestName ?? "—"}</p>
                <p className="text-sm text-muted">{detail.guestEmail ?? "—"}</p>
                <p className="text-sm text-muted">
                  Booked {fmtBookedAt(detail.createdAt, timeZone)}
                </p>
              </div>

              <div className="mt-6 border-t border-stone pt-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
                  Price
                </h3>
                <p className="mt-2 font-mono text-sm text-ink">
                  {detail.teeSlot.price != null
                    ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(detail.teeSlot.price)} × ${detail.playersCount} players`
                    : "—"}
                </p>
              </div>

              {bookingId ? (
                <BookingDrawerAddons
                  detail={detail}
                  bookingId={bookingId}
                  onReload={reloadBooking}
                />
              ) : null}

              <div className="mt-6 border-t border-stone pt-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
                  Players
                </h3>
                <ul className="mt-3 space-y-3">
                  {detail.players.map((pl) => {
                    const busy = pending.has(pl.id);
                    const checked = pl.checkedIn === true;
                    const noshow = pl.noShow === true;
                    return (
                      <li
                        key={pl.id}
                        className="flex items-center gap-3 rounded-lg border border-stone bg-white p-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-xs font-semibold text-ink">
                          {(pl.name ?? "?")
                            .split(/\s+/)
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {pl.name ?? "Player"}
                          </p>
                          {pl.email ? (
                            <p className="truncate text-xs text-muted">
                              {pl.email}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-1">
                          {!checked && !noshow ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="border-stone bg-cream text-muted"
                              disabled={busy}
                              onClick={() =>
                                patchPlayer(pl.id, { checkedIn: true })
                              }
                            >
                              Check in
                            </Button>
                          ) : null}
                          {checked ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="border border-emerald-200 bg-emerald-50 text-emerald-800"
                              disabled={busy}
                              onClick={() =>
                                patchPlayer(pl.id, { checkedIn: false })
                              }
                            >
                              ✓ In
                            </Button>
                          ) : null}
                          {!noshow ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="border border-red-200 bg-red-50 text-red-700"
                              disabled={busy}
                              onClick={() =>
                                patchPlayer(pl.id, { noShow: true })
                              }
                            >
                              No-show
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="border border-red-200 bg-red-50 text-red-700"
                              disabled={busy}
                              onClick={() =>
                                patchPlayer(pl.id, { noShow: false })
                              }
                            >
                              Undo no-show
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {detail.notes ? (
                <div className="mt-4 rounded-lg bg-cream/80 p-3 text-sm text-muted">
                  {detail.notes}
                </div>
              ) : null}

              <div className="mt-8 flex flex-col gap-2 border-t border-stone pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel booking
                </Button>
                <Button
                  type="button"
                  variant="default"
                  className="w-full"
                  disabled={changedPlayers.size === 0}
                  onClick={onClose}
                >
                  Save changes
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={onCancelBooking}>
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
