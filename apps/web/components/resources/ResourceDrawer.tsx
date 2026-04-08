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
import type {
  PoolMaintenanceHoldRow,
  ResourceItemRow,
  ResourceTypeRow,
} from "@/lib/resource-types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ResourceEditDialog } from "./ResourceEditDialog";

function typeBadgeText(t: ResourceTypeRow): string {
  if (t.usageModel === "rental" && t.trackingMode === "pool") return "Pool";
  if (t.usageModel === "rental" && t.trackingMode === "individual") {
    const a = t.assignmentStrategy === "auto" ? "Auto" : "Manual";
    return `Individual · ${a}`;
  }
  if (t.usageModel === "consumable") return "Consumable";
  return "Service";
}

function badgeStyle(t: ResourceTypeRow): string {
  if (t.usageModel === "rental")
    return "bg-[var(--rental-tint)] text-fairway";
  if (t.usageModel === "consumable")
    return "bg-[var(--inventory-tint)] text-[color:var(--tag-gold-fg)]";
  return "bg-[var(--service-tint)] text-[color:var(--service-accent)]";
}

function heroClass(t: ResourceTypeRow): string {
  if (t.usageModel === "rental") return "bg-forest";
  if (t.usageModel === "consumable") return "bg-[color:var(--inventory-hero)]";
  return "bg-[color:var(--service-accent)]";
}

export type ResourceDrawerProps = {
  resourceId: string | null;
  resource: ResourceTypeRow | null;
  clubId: string;
  onClose: () => void;
  onUpdated: () => void;
};

export function ResourceDrawer({
  resourceId,
  resource,
  clubId,
  onClose,
  onUpdated,
}: ResourceDrawerProps) {
  const isTablet = useMediaQuery("(max-width: 1023px)");
  const open = resourceId !== null && resource !== null;

  const [items, setItems] = useState<ResourceItemRow[]>([]);
  const [holds, setHolds] = useState<PoolMaintenanceHoldRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingHolds, setLoadingHolds] = useState(false);
  const [itemBusyId, setItemBusyId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockSaving, setRestockSaving] = useState(false);
  const [restockError, setRestockError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [localStock, setLocalStock] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!open) setEditOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !resource) {
      setItems([]);
      setHolds([]);
      setLocalStock(null);
      setRestockQty("");
      setRestockError("");
      return;
    }
    setLocalStock(resource.currentStock);
  }, [open, resource]);

  useEffect(() => {
    if (!open || !resource || !resourceId) return;

    if (resource.trackingMode === "individual") {
      setLoadingItems(true);
      void fetch(`/api/clubs/${clubId}/resources/${resourceId}/items`, {
        credentials: "include",
      })
        .then(async (res) => {
          if (!res.ok) return;
          const rows = (await res.json()) as ResourceItemRow[];
          setItems(rows);
        })
        .finally(() => setLoadingItems(false));
    } else {
      setItems([]);
    }

    if (resource.usageModel === "rental" && resource.trackingMode === "pool") {
      setLoadingHolds(true);
      void fetch(
        `/api/clubs/${clubId}/resources/${resourceId}/maintenance-holds`,
        { credentials: "include" }
      )
        .then(async (res) => {
          if (!res.ok) return;
          const rows = (await res.json()) as PoolMaintenanceHoldRow[];
          setHolds(rows.filter((h) => h.resolvedAt == null));
        })
        .finally(() => setLoadingHolds(false));
    } else {
      setHolds([]);
    }
  }, [open, resource, resourceId, clubId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const patchItem = useCallback(
    async (
      itemId: string,
      body: { operationalStatus: "available" | "maintenance" }
    ) => {
      if (!resourceId) return;
      setItemBusyId(itemId);
      try {
        const res = await fetch(
          `/api/clubs/${clubId}/resources/${resourceId}/items/${itemId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(
            (data as { error?: string }).error ?? "Could not update unit"
          );
          return;
        }
        onUpdated();
        const listRes = await fetch(
          `/api/clubs/${clubId}/resources/${resourceId}/items`,
          { credentials: "include" }
        );
        if (listRes.ok) {
          setItems((await listRes.json()) as ResourceItemRow[]);
        }
      } finally {
        setItemBusyId(null);
      }
    },
    [clubId, resourceId, onUpdated]
  );

  const onToggleItem = useCallback(
    (it: ResourceItemRow) => {
      const nextStatus =
        it.operationalStatus === "available" ? "maintenance" : "available";
      void patchItem(it.id, { operationalStatus: nextStatus });
    },
    [patchItem]
  );

  const resolveHold = useCallback(
    async (holdId: string) => {
      if (!resourceId) return;
      const res = await fetch(
        `/api/clubs/${clubId}/resources/${resourceId}/maintenance-holds/${holdId}/resolve`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: "{}",
        }
      );
      if (!res.ok) {
        toast.error("Could not resolve hold");
        return;
      }
      setHolds((h) => h.filter((x) => x.id !== holdId));
      onUpdated();
    },
    [clubId, resourceId, onUpdated]
  );

  const submitRestock = useCallback(async () => {
    if (!resourceId || !resource) return;
    const n = Number(restockQty);
    if (!Number.isFinite(n) || n === 0) {
      setRestockError("Enter a non-zero quantity");
      return;
    }
    setRestockSaving(true);
    setRestockError("");
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/resources/${resourceId}/restock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ deltaQuantity: n, reason: null }),
        }
      );
      if (res.status === 409) {
        setRestockError("Stock would go negative");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRestockError(
          (data as { error?: string }).error ?? "Restock failed"
        );
        return;
      }
      const data = (await res.json()) as { currentStock?: number };
      if (data.currentStock != null) setLocalStock(data.currentStock);
      setRestockQty("");
      onUpdated();
      toast.success("Stock updated");
    } finally {
      setRestockSaving(false);
    }
  }, [clubId, resource, resourceId, restockQty, onUpdated]);

  const submitDelete = useCallback(async () => {
    if (!resourceId) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/resources/${resourceId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (res.status === 409) {
        setDeleteError("Retire all units before deleting.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(
          (data as { error?: string }).error ?? "Could not delete"
        );
        return;
      }
      setDeleteOpen(false);
      onClose();
      onUpdated();
      toast.success("Resource removed");
    } finally {
      setDeleteBusy(false);
    }
  }, [clubId, resourceId, onClose, onUpdated]);

  if (!open || !resource) return null;

  const stockDisplay =
    localStock !== null ? localStock : (resource.currentStock ?? 0);

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
          "fixed right-0 top-0 z-50 h-full overflow-y-auto border-l border-stone bg-warm-white transition-transform duration-200 ease-out",
          isTablet ? "w-full" : "w-[420px]",
          "translate-x-0"
        )}
      >
        <div className="flex items-start gap-3 border-b border-stone px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone bg-cream text-muted hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base text-ink">{resource.name}</h2>
            <span
              className={cn(
                "mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em]",
                badgeStyle(resource)
              )}
            >
              {typeBadgeText(resource)}
            </span>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div
            className={cn(
              "relative overflow-hidden rounded-xl px-4 py-4 text-white",
              heroClass(resource)
            )}
          >
            <span
              className="pointer-events-none absolute -right-5 -top-8 h-[130px] w-[130px] rounded-full border border-white/10"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute bottom-[-40px] right-5 h-20 w-20 rounded-full border border-white/[0.08]"
              aria-hidden
            />
            <p className="relative z-[1] text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
              {resource.usageModel === "rental"
                ? "Rental"
                : resource.usageModel === "consumable"
                  ? "Inventory"
                  : "Service"}
            </p>
            <p className="relative z-[1] mt-1 font-display text-[19px] leading-tight">
              {resource.name}
            </p>
            <div className="relative z-[1] mt-3 flex flex-wrap gap-4">
              {resource.usageModel === "rental" ? (
                <>
                  <div>
                    <p className="font-display text-[22px] leading-none">
                      {resource.availableNow ?? 0}
                    </p>
                    <p className="mt-0.5 text-[10px] tracking-wide text-white/45">
                      Available
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-[22px] leading-none">
                      {resource.totalUnits ?? "—"}
                    </p>
                    <p className="mt-0.5 text-[10px] tracking-wide text-white/45">
                      Total
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-[22px] leading-none">
                      {resource.inMaintenance}
                    </p>
                    <p className="mt-0.5 text-[10px] tracking-wide text-white/45">
                      Maintenance
                    </p>
                  </div>
                </>
              ) : null}
              {resource.usageModel === "consumable" ? (
                <div>
                  <p className="font-display text-[22px] leading-none">
                    {stockDisplay}
                  </p>
                  <p className="mt-0.5 text-[10px] tracking-wide text-white/45">
                    In stock
                  </p>
                </div>
              ) : null}
              {resource.usageModel === "service" ? (
                <p className="text-sm text-white/80">
                  {resource.active ? "Active" : "Inactive"}
                </p>
              ) : null}
            </div>
            <div className="relative z-[1] mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-grass" />
              <span className="text-white/90">
                {resource.active ? "Listed" : "Hidden"}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Details
            </h3>
            <dl className="space-y-2 text-sm">
              {resource.usageModel === "rental" ? (
                <>
                  <div className="flex justify-between gap-3 border-b border-stone/80 py-1.5">
                    <dt className="text-muted">Assignment</dt>
                    <dd className="font-medium text-ink">
                      {resource.trackingMode === "individual"
                        ? resource.assignmentStrategy === "auto"
                          ? "Auto"
                          : "Manual"
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-stone/80 py-1.5">
                    <dt className="text-muted">Pricing</dt>
                    <dd className="font-medium text-ink">—</dd>
                  </div>
                </>
              ) : null}
              {resource.usageModel === "consumable" ? (
                <>
                  <div className="flex justify-between gap-3 border-b border-stone/80 py-1.5">
                    <dt className="text-muted">Current stock</dt>
                    <dd className="font-medium text-ink">{stockDisplay}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-stone/80 py-1.5">
                    <dt className="text-muted">Restock threshold</dt>
                    <dd className="font-medium text-ink">—</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-stone/80 py-1.5">
                    <dt className="text-muted">Price</dt>
                    <dd className="font-medium text-ink">—</dd>
                  </div>
                </>
              ) : null}
              {resource.usageModel === "service" ? (
                <div className="flex justify-between gap-3 border-b border-stone/80 py-1.5">
                  <dt className="text-muted">Availability</dt>
                  <dd className="font-medium text-ink">
                    {resource.active ? "Active" : "Inactive"}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="text-muted">Notes</dt>
                <dd className="max-w-[220px] text-right font-medium text-ink">
                  {resource.notes?.trim() || "—"}
                </dd>
              </div>
            </dl>
          </div>

          {resource.trackingMode === "individual" ? (
            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                Units
              </h3>
              {loadingItems ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted">No units yet.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((it) => (
                    <li
                      key={it.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-stone bg-white px-3 py-2"
                    >
                      <span className="w-[62px] shrink-0 font-mono text-[11px] text-muted">
                        {it.id.slice(0, 8)}…
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">
                        {it.label}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          it.operationalStatus === "available"
                            ? "text-[color:var(--status-available)]"
                            : it.operationalStatus === "maintenance"
                              ? "text-[color:var(--status-maintenance)]"
                              : "text-muted"
                        )}
                      >
                        {it.operationalStatus}
                      </span>
                      <div className="flex w-full justify-end gap-2 sm:w-auto">
                        {it.operationalStatus === "available" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={itemBusyId === it.id}
                            onClick={() => onToggleItem(it)}
                          >
                            {itemBusyId === it.id ? "…" : "Maintain"}
                          </Button>
                        ) : null}
                        {it.operationalStatus === "maintenance" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-fairway text-fairway"
                            disabled={itemBusyId === it.id}
                            onClick={() => onToggleItem(it)}
                          >
                            {itemBusyId === it.id ? "…" : "Return"}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {resource.usageModel === "rental" &&
          resource.trackingMode === "pool" ? (
            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                Pool maintenance holds
              </h3>
              {loadingHolds ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : holds.length === 0 ? (
                <p className="text-sm text-muted">No active holds.</p>
              ) : (
                <ul className="space-y-2">
                  {holds.map((h) => (
                    <li
                      key={h.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone bg-cream/50 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-ink">
                          {h.reason?.trim() || "Hold"}
                        </p>
                        <p className="text-xs text-muted">
                          {format(new Date(h.startedAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void resolveHold(h.id)}
                      >
                        Resolve
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {resource.usageModel === "consumable" && resource.trackInventory ? (
            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                Restock
              </h3>
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  placeholder="Quantity to add"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="min-w-[140px] flex-1 rounded-lg border border-stone px-3 py-2 text-sm text-ink outline-none focus:border-grass"
                />
                <Button
                  type="button"
                  onClick={() => void submitRestock()}
                  disabled={restockSaving}
                >
                  {restockSaving ? "Adding…" : "Add stock"}
                </Button>
              </div>
              {restockError ? (
                <p className="mt-2 text-sm text-red-700">{restockError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-stone pt-4">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={() => {
                setDeleteError("");
                setDeleteOpen(true);
              }}
            >
              Delete
            </Button>
            <Button
              type="button"
              className="w-full bg-fairway hover:bg-fairway/90"
              onClick={() => setEditOpen(true)}
            >
              Edit details
            </Button>
          </div>
        </div>
      </div>

      {editOpen && resource ? (
        <ResourceEditDialog
          key={resource.id}
          resource={resource}
          clubId={clubId}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            onUpdated();
            toast.success("Details saved");
          }}
        />
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {resource.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone if items are still active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="text-sm text-red-700">{deleteError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void submitDelete();
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
