"use client";

import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { BookingDetail } from "./types";

type ResourceItemRow = {
  id: string;
  label: string;
  operationalStatus: string;
};

export function BookingDrawerAddons({
  detail,
  bookingId,
  onReload,
}: {
  detail: BookingDetail;
  bookingId: string;
  onReload: () => Promise<void>;
}) {
  const addons = detail.addons;
  if (!addons?.length) return null;

  const clubId = detail.teeSlot.clubId;
  if (!clubId) return null;

  return (
    <div className="mt-6 border-t border-stone pt-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
        Add-ons
      </h3>
      <ul className="mt-3 space-y-4">
        {addons.map((line) => (
          <AddonLineCard
            key={line.id}
            line={line}
            clubId={clubId}
            bookingId={bookingId}
            onReload={onReload}
          />
        ))}
      </ul>
    </div>
  );
}

function AddonLineCard({
  line,
  clubId,
  bookingId,
  onReload,
}: {
  line: NonNullable<BookingDetail["addons"]>[number];
  clubId: string;
  bookingId: string;
  onReload: () => Promise<void>;
}) {
  const [items, setItems] = useState<ResourceItemRow[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const strat = line.assignmentStrategy;
  const lineTotal = ((line.unitPriceCents * line.quantity) / 100).toFixed(2);

  const loadItems = useCallback(async () => {
    if (strat !== "manual" || !line.resourceTypeId) return;
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/resources/${line.resourceTypeId}/items`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as ResourceItemRow[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
  }, [clubId, line.resourceTypeId, strat]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function assign() {
    if (!pick) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/bookings/${bookingId}/addons/${line.id}/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ resourceItemId: pick }),
        }
      );
      if (!res.ok) {
        toast.error("Could not assign item");
        return;
      }
      setPick("");
      await onReload();
      toast.success("Assigned");
    } finally {
      setBusy(false);
    }
  }

  async function unassign(assignmentId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/bookings/${bookingId}/addons/${line.id}/assignments/${assignmentId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        toast.error("Could not unassign");
        return;
      }
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  const uc = line.catalogUnitsConsumed ?? 1;
  const slotsNeeded = line.quantity * (uc > 0 ? uc : 1);

  return (
    <li className="rounded-lg border border-stone bg-white p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">{line.name}</p>
        <p className="font-mono text-xs text-muted">
          {line.quantity} × ${(line.unitPriceCents / 100).toFixed(2)} = ${lineTotal}
        </p>
      </div>
      {strat === "none" || !line.resourceTypeId ? (
        <p className="mt-2 text-xs text-muted">No unit assignment for this add-on.</p>
      ) : null}
      {strat === "auto" ? (
        <div className="mt-2 text-xs text-muted">
          {line.assignments.length > 0 ? (
            <ul className="space-y-1">
              {line.assignments.map((a) => (
                <li key={a.id}>• {a.label}</li>
              ))}
            </ul>
          ) : (
            <span>Units assigned at booking.</span>
          )}
        </div>
      ) : null}
      {strat === "manual" ? (
        <div className="mt-3 space-y-2">
          {line.assignments.length > 0 ? (
            <ul className="space-y-1">
              {line.assignments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span>{a.label}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 border-stone text-xs"
                    disabled={busy}
                    onClick={() => unassign(a.id)}
                  >
                    Unassign
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {line.assignments.length < slotsNeeded ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="min-w-[160px] flex-1 rounded-md border border-stone bg-warm-white px-2 py-1.5 text-xs text-ink"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                disabled={busy}
              >
                <option value="">Select unit…</option>
                {items
                  .filter((i) => i.operationalStatus === "available")
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="border-stone"
                disabled={busy || !pick}
                onClick={() => assign()}
              >
                Assign
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
