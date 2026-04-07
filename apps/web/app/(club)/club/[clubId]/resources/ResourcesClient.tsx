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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export type ResourceTypeRow = {
  id: string;
  name: string;
  usageModel: "rental" | "consumable" | "service";
  trackingMode: "pool" | "individual" | null;
  assignmentStrategy: "auto" | "manual" | "none";
  /** DB column or computed aggregate depending on usage model */
  totalUnits: number | null;
  trackInventory: boolean;
  currentStock: number | null;
  rentalWindows: Record<string, number> | null;
  turnaroundBufferMinutes: number;
  notes: string | null;
  sortOrder: number;
  active: boolean;
  availableNow: number | null;
  inMaintenance: number;
  inUseBooked: number;
  overAllocated: boolean;
  activeHoldsCount: number | null;
};

export type ResourceItemRow = {
  id: string;
  label: string;
  operationalStatus: string;
  maintenanceNote: string | null;
};

const WINDOW_KEYS = ["9hole", "18hole", "27hole", "36hole", "default"] as const;

function hoursInputToMinutes(h: string): number {
  const n = parseFloat(h.replace(",", "."));
  if (Number.isNaN(n) || n <= 0) return 60;
  return Math.round(n * 60);
}

function UsageModelBadge({ t }: { t: ResourceTypeRow }) {
  const label =
    t.usageModel === "rental"
      ? t.trackingMode === "pool"
        ? "Pool"
        : "Individual"
      : t.usageModel === "consumable"
        ? "Consumable"
        : "Service";
  return (
    <span className="inline-flex rounded-full bg-fairway/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fairway">
      {label}
    </span>
  );
}

function AssignmentBadge({
  strategy,
  trackingMode,
}: {
  strategy: ResourceTypeRow["assignmentStrategy"];
  trackingMode: ResourceTypeRow["trackingMode"];
}) {
  if (trackingMode !== "individual") return null;
  const label =
    strategy === "auto" ? "Auto-assign" : "Manual-assign";
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
      {label}
    </span>
  );
}

function ItemStatusDot({ status }: { status: string }) {
  const color =
    status === "available"
      ? "bg-grass"
      : status === "maintenance"
        ? "bg-amber-500"
        : status === "retired"
          ? "bg-stone"
          : "bg-stone";
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", color)}
      title={status}
    />
  );
}

export function ResourcesClient({
  clubId,
  resources: initial,
}: {
  clubId: string;
  resources: ResourceTypeRow[];
}) {
  const [resources, setResources] = useState<ResourceTypeRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [modalUsage, setModalUsage] = useState<
    "rental" | "consumable" | "service" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  const [trackingMode, setTrackingMode] = useState<"pool" | "individual">(
    "pool"
  );
  const [assignmentStrategy, setAssignmentStrategy] = useState<"auto" | "manual">(
    "manual"
  );
  const [totalUnits, setTotalUnits] = useState(8);
  const [rentalHours, setRentalHours] = useState<Record<string, string>>({
    "9hole": "2.5",
    "18hole": "4.5",
    "27hole": "6.5",
    "36hole": "8.5",
    default: "4.5",
  });
  const [turnaroundBufferMinutes, setTurnaroundBufferMinutes] = useState(15);

  const [trackInventory, setTrackInventory] = useState(false);
  const [initialStock, setInitialStock] = useState(0);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [itemsByType, setItemsByType] = useState<
    Record<string, ResourceItemRow[]>
  >({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);

  const [itemMenuId, setItemMenuId] = useState<string | null>(null);
  const [addItemLabel, setAddItemLabel] = useState("");
  const [addItemSaving, setAddItemSaving] = useState(false);

  const [retireTarget, setRetireTarget] = useState<{
    typeId: string;
    itemId: string;
    label: string;
  } | null>(null);

  const [restockTypeId, setRestockTypeId] = useState<string | null>(null);
  const [restockDelta, setRestockDelta] = useState(10);
  const [restockReason, setRestockReason] = useState("");
  const [restockSaving, setRestockSaving] = useState(false);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/clubs/${clubId}/resources`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Could not refresh resources.");
        return;
      }
      const data = (await res.json()) as ResourceTypeRow[];
      setResources(data);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  const rentals = useMemo(
    () => resources.filter((r) => r.usageModel === "rental"),
    [resources]
  );
  const consumables = useMemo(
    () => resources.filter((r) => r.usageModel === "consumable"),
    [resources]
  );
  const services = useMemo(
    () => resources.filter((r) => r.usageModel === "service"),
    [resources]
  );

  function openModal(usage: "rental" | "consumable" | "service") {
    setModalUsage(usage);
    setFormError("");
    setName("");
    setNotes("");
    setActive(true);
    setSortOrder(0);
    setTrackingMode("pool");
    setAssignmentStrategy("manual");
    setTotalUnits(8);
    setRentalHours({
      "9hole": "2.5",
      "18hole": "4.5",
      "27hole": "6.5",
      "36hole": "8.5",
      default: "4.5",
    });
    setTurnaroundBufferMinutes(15);
    setTrackInventory(false);
    setInitialStock(0);
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!modalUsage) return;
    setFormError("");
    setSaving(true);
    try {
      let body: Record<string, unknown>;

      if (modalUsage === "rental") {
        const rentalWindows: Record<string, number> = {};
        for (const k of WINDOW_KEYS) {
          rentalWindows[k] = hoursInputToMinutes(rentalHours[k] ?? "4.5");
        }
        body = {
          name: name.trim(),
          usageModel: "rental",
          trackingMode,
          assignmentStrategy:
            trackingMode === "pool"
              ? "none"
              : assignmentStrategy,
          totalUnits: trackingMode === "pool" ? totalUnits : null,
          rentalWindows,
          turnaroundBufferMinutes,
          notes: notes.trim() || null,
          sortOrder,
          active,
        };
      } else if (modalUsage === "consumable") {
        body = {
          name: name.trim(),
          usageModel: "consumable",
          trackingMode: null,
          assignmentStrategy: "none",
          trackInventory,
          currentStock: trackInventory ? initialStock : null,
          notes: notes.trim() || null,
          sortOrder,
          active,
        };
      } else {
        body = {
          name: name.trim(),
          usageModel: "service",
          trackingMode: null,
          assignmentStrategy: "none",
          notes: notes.trim() || null,
          sortOrder,
          active,
        };
      }

      const res = await fetch(`/api/clubs/${clubId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(
          (data as { error?: string }).error ?? "Failed to create resource type"
        );
        return;
      }
      setModalUsage(null);
      await refreshList();
    } finally {
      setSaving(false);
    }
  }

  async function toggleExpand(typeId: string) {
    const next = new Set(expanded);
    if (next.has(typeId)) {
      next.delete(typeId);
    } else {
      next.add(typeId);
      void loadItems(typeId);
    }
    setExpanded(next);
  }

  async function loadItems(typeId: string) {
    setItemsLoading(typeId);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/resources/${typeId}/items`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const rows = (await res.json()) as ResourceItemRow[];
      setItemsByType((prev) => ({ ...prev, [typeId]: rows }));
    } finally {
      setItemsLoading(null);
    }
  }

  async function patchItem(
    typeId: string,
    itemId: string,
    body: { operationalStatus?: string; reason?: string | null }
  ) {
    const res = await fetch(
      `/api/clubs/${clubId}/resources/${typeId}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Update failed");
      return;
    }
    await loadItems(typeId);
    await refreshList();
  }

  async function handleAddItem(typeId: string) {
    const label = addItemLabel.trim();
    if (!label) return;
    setAddItemSaving(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/resources/${typeId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            operationalStatus: "available",
          }),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Could not add item");
        return;
      }
      setAddItemLabel("");
      await loadItems(typeId);
      await refreshList();
    } finally {
      setAddItemSaving(false);
    }
  }

  async function submitRestock() {
    if (!restockTypeId) return;
    setRestockSaving(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/resources/${restockTypeId}/restock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deltaQuantity: restockDelta,
            reason: restockReason.trim() || null,
          }),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Restock failed");
        return;
      }
      setRestockTypeId(null);
      await refreshList();
    } finally {
      setRestockSaving(false);
    }
  }

  function renderCard(t: ResourceTypeRow) {
    const isIndividual =
      t.usageModel === "rental" && t.trackingMode === "individual";
    const isPool = t.usageModel === "rental" && t.trackingMode === "pool";

    return (
      <div
        key={t.id}
        className={cn(
          "overflow-hidden rounded-xl border border-stone bg-white shadow-sm",
          !t.active && "opacity-75"
        )}
      >
        {t.overAllocated ? (
          <div className="bg-red-600 px-3 py-1.5 text-center text-xs font-semibold text-white">
            ⚠ Over-allocated
          </div>
        ) : null}
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold text-ink">
                {t.name}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <UsageModelBadge t={t} />
                <AssignmentBadge
                  strategy={t.assignmentStrategy}
                  trackingMode={t.trackingMode}
                />
              </div>
            </div>
            {!t.overAllocated ? (
              <div className="shrink-0 text-right text-xs">
                <span className="font-medium text-grass">● Available</span>
              </div>
            ) : null}
          </div>

          <div className="mt-3 space-y-2 text-sm text-muted">
            {isIndividual ? (
              <>
                <p>
                  <span className="font-semibold text-grass">
                    {t.availableNow ?? 0}
                  </span>{" "}
                  <span className="text-ink">available</span>
                  <span className="text-muted"> / </span>
                  <span className="font-semibold text-ink">
                    {t.totalUnits ?? 0}
                  </span>{" "}
                  <span className="text-muted">total</span>
                </p>
                {t.inMaintenance > 0 ? (
                  <p className="text-amber-700">
                    {t.inMaintenance} in maintenance
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void toggleExpand(t.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-fairway hover:underline"
                >
                  {expanded.has(t.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {expanded.has(t.id) ? "Hide units" : "Show units"}
                </button>
                {expanded.has(t.id) ? (
                  <div className="mt-2 rounded-lg border border-stone bg-cream/40 p-3">
                    {itemsLoading === t.id ? (
                      <p className="text-xs text-muted">Loading…</p>
                    ) : (itemsByType[t.id]?.length ?? 0) === 0 ? (
                      <p className="text-xs text-muted">
                        No units yet. Add a label below to create the first
                        unit.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {(itemsByType[t.id] ?? []).map((it) => (
                          <li
                            key={it.id}
                            className="flex flex-wrap items-center gap-2 border-b border-stone/60 pb-2 last:border-0 last:pb-0"
                          >
                            <ItemStatusDot status={it.operationalStatus} />
                            <span className="min-w-0 flex-1 font-medium text-ink">
                              {it.label}
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {it.operationalStatus === "available" ? (
                                <button
                                  type="button"
                                  className="rounded-md border border-stone bg-white px-2 py-1 text-[11px] font-semibold text-ink hover:bg-cream"
                                  onClick={() =>
                                    void patchItem(t.id, it.id, {
                                      operationalStatus: "maintenance",
                                    })
                                  }
                                >
                                  Mark maintenance
                                </button>
                              ) : null}
                              {it.operationalStatus === "maintenance" ? (
                                <button
                                  type="button"
                                  className="rounded-md border border-stone bg-white px-2 py-1 text-[11px] font-semibold text-ink hover:bg-cream"
                                  onClick={() =>
                                    void patchItem(t.id, it.id, {
                                      operationalStatus: "available",
                                    })
                                  }
                                >
                                  Mark available
                                </button>
                              ) : null}
                              <div className="relative">
                                <button
                                  type="button"
                                  className="rounded-md p-1 text-muted hover:bg-stone/60 hover:text-ink"
                                  aria-label="More actions"
                                  onClick={() =>
                                    setItemMenuId(
                                      itemMenuId === it.id ? null : it.id
                                    )
                                  }
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                                {itemMenuId === it.id ? (
                                  <div className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-md border border-stone bg-white py-1 shadow-md">
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-1.5 text-left text-xs text-red-700 hover:bg-red-50"
                                      onClick={() => {
                                        setItemMenuId(null);
                                        setRetireTarget({
                                          typeId: t.id,
                                          itemId: it.id,
                                          label: it.label,
                                        });
                                      }}
                                    >
                                      Retire
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        placeholder="New unit label"
                        value={addItemLabel}
                        onChange={(e) => setAddItemLabel(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-stone px-2 py-1.5 text-xs text-ink"
                      />
                      <button
                        type="button"
                        disabled={addItemSaving}
                        onClick={() => void handleAddItem(t.id)}
                        className="shrink-0 rounded-lg bg-fairway px-3 py-1.5 text-xs font-semibold text-white hover:bg-fairway/90 disabled:opacity-50"
                      >
                        Add unit
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {isPool ? (
              <>
                <p>
                  <span className="font-semibold text-grass">
                    {t.availableNow ?? 0}
                  </span>{" "}
                  available,{" "}
                  <span className="font-semibold text-amber-700">
                    {t.inMaintenance}
                  </span>{" "}
                  in maintenance
                </p>
                <p className="text-xs">
                  Active holds:{" "}
                  <span className="font-mono font-semibold text-ink">
                    {t.activeHoldsCount ?? 0}
                  </span>
                </p>
              </>
            ) : null}

            {t.usageModel === "consumable" ? (
              t.trackInventory ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    Stock:{" "}
                    <span className="font-mono font-semibold text-ink">
                      {t.currentStock ?? 0}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRestockTypeId(t.id);
                      setRestockDelta(10);
                      setRestockReason("");
                    }}
                    className="rounded-lg border border-fairway px-2.5 py-1 text-xs font-semibold text-fairway hover:bg-fairway/10"
                  >
                    Restock
                  </button>
                </div>
              ) : (
                <span className="inline-flex rounded-full bg-grass/15 px-2 py-0.5 text-xs font-semibold text-fairway">
                  Unlimited — not tracked
                </span>
              )
            ) : null}

            {t.usageModel === "service" ? (
              <p className="rounded-lg bg-cream px-3 py-2 text-xs text-muted">
                Availability managed manually
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SetTopBar title="Resources" />
      <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">
            Resources
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Manage rentals, consumables, and services for your club.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setError("")}
            >
              Dismiss
            </button>
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted">Refreshing…</p>
        ) : null}

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
              Rentals
            </p>
            <button
              type="button"
              onClick={() => openModal("rental")}
              className="rounded-lg bg-fairway px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-fairway/90"
            >
              Add rental
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {rentals.length === 0 ? (
              <p className="text-sm text-muted">No rental types yet.</p>
            ) : (
              rentals.map(renderCard)
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
              Consumables
            </p>
            <button
              type="button"
              onClick={() => openModal("consumable")}
              className="rounded-lg bg-fairway px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-fairway/90"
            >
              Add consumable
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {consumables.length === 0 ? (
              <p className="text-sm text-muted">No consumable types yet.</p>
            ) : (
              consumables.map(renderCard)
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
              Services
            </p>
            <button
              type="button"
              onClick={() => openModal("service")}
              className="rounded-lg bg-fairway px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-fairway/90"
            >
              Add service
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {services.length === 0 ? (
              <p className="text-sm text-muted">No service types yet.</p>
            ) : (
              services.map(renderCard)
            )}
          </div>
        </section>
      </div>

      <Dialog
        open={modalUsage !== null}
        onOpenChange={(o) => !o && setModalUsage(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalUsage === "rental"
                ? "Add rental type"
                : modalUsage === "consumable"
                  ? "Add consumable type"
                  : "Add service type"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                Name
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-stone px-3 py-2 text-sm text-ink"
                placeholder="e.g. Cart fleet"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-stone px-3 py-2 text-sm text-ink"
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Active
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Sort order</span>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-stone px-2 py-1 text-sm"
                />
              </div>
            </div>

            {modalUsage === "rental" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                    Tracking mode
                  </p>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="tm"
                        checked={trackingMode === "pool"}
                        onChange={() => setTrackingMode("pool")}
                      />
                      Pool
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="tm"
                        checked={trackingMode === "individual"}
                        onChange={() => setTrackingMode("individual")}
                      />
                      Individual
                    </label>
                  </div>
                </div>
                {trackingMode === "individual" ? (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                      Assignment
                    </p>
                    <label className="mb-2 flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="as"
                        checked={assignmentStrategy === "auto"}
                        onChange={() => setAssignmentStrategy("auto")}
                      />
                      <span>
                        Automatically assign units at booking time
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="as"
                        checked={assignmentStrategy === "manual"}
                        onChange={() => setAssignmentStrategy("manual")}
                      />
                      <span>Assign at check-in by staff</span>
                    </label>
                  </div>
                ) : null}
                {trackingMode === "pool" ? (
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                      Total units
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={totalUnits}
                      onChange={(e) =>
                        setTotalUnits(Number(e.target.value) || 1)
                      }
                      className="w-full rounded-lg border border-stone px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                    Rental windows (hours)
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {WINDOW_KEYS.map((k) => (
                      <div key={k}>
                        <label className="mb-0.5 block text-xs capitalize text-muted">
                          {k === "default" ? "Default" : k.replace("hole", "-hole")}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={rentalHours[k] ?? ""}
                          onChange={(e) =>
                            setRentalHours((prev) => ({
                              ...prev,
                              [k]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-stone px-2 py-1.5 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                    Turnaround buffer (minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={turnaroundBufferMinutes}
                    onChange={(e) =>
                      setTurnaroundBufferMinutes(Number(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-stone px-3 py-2 text-sm"
                  />
                </div>
              </>
            ) : null}

            {modalUsage === "consumable" ? (
              <>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={trackInventory}
                    onChange={(e) => setTrackInventory(e.target.checked)}
                  />
                  Track inventory
                </label>
                {trackInventory ? (
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                      Initial stock
                    </label>
                    <input
                      type="number"
                      min={0}
                      required={trackInventory}
                      value={initialStock}
                      onChange={(e) =>
                        setInitialStock(Number(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-stone px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {modalUsage === "service" ? (
              <p className="rounded-lg bg-cream px-3 py-2 text-xs text-muted">
                Scheduling for services is a separate future feature.
              </p>
            ) : null}

            {formError ? (
              <p className="text-sm text-red-600">{formError}</p>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <button
                type="button"
                onClick={() => setModalUsage(null)}
                className="rounded-lg border border-stone px-4 py-2 text-sm font-semibold text-ink hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white hover:bg-fairway/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Create"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={retireTarget !== null}
        onOpenChange={(o) => !o && setRetireTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire unit?</AlertDialogTitle>
            <AlertDialogDescription>
              Retire &quot;{retireTarget?.label}&quot;? This cannot be undone
              from the staff UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!retireTarget) return;
                void patchItem(retireTarget.typeId, retireTarget.itemId, {
                  operationalStatus: "retired",
                });
                setRetireTarget(null);
              }}
            >
              Retire
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={restockTypeId !== null}
        onOpenChange={(o) => !o && setRestockTypeId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Quantity to add
              </label>
              <input
                type="number"
                value={restockDelta}
                onChange={(e) => setRestockDelta(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-stone px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Reason (optional)
              </label>
              <input
                type="text"
                value={restockReason}
                onChange={(e) => setRestockReason(e.target.value)}
                className="w-full rounded-lg border border-stone px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRestockTypeId(null)}
              className="rounded-lg border border-stone px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={restockSaving || restockDelta === 0}
              onClick={() => void submitRestock()}
              className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {restockSaving ? "Saving…" : "Apply"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
