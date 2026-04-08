"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ResourceTypeRow } from "@/lib/resource-types";
import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";
import {
  rentalHoursStringsFromApi,
  rentalWindowsPayloadFromForm,
  WINDOW_KEYS,
} from "./wizard-types";

const labelCls =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted";

const inputCls =
  "w-full rounded-lg border-[1.5px] border-stone bg-white px-[11px] py-[9px] text-[13px] text-ink outline-none transition placeholder:text-muted/70 focus:border-grass focus:ring-0 focus-visible:ring-2 focus-visible:ring-grass/25";

const inputErr = "border-red-400 focus:border-red-500";

const HOLE_LABELS: Record<(typeof WINDOW_KEYS)[number], string> = {
  "9hole": "9h",
  "18hole": "18h",
  "27hole": "27h",
  "36hole": "36h",
  default: "Default",
};

type EditFormState = {
  name: string;
  notes: string;
  active: boolean;
  sortOrder: number;
  assignmentStrategy: "auto" | "manual";
  totalUnits: number;
  rentalHours: Record<string, string>;
  syncRentalWindows: boolean;
  turnaroundBufferMinutes: number;
  trackInventory: boolean;
  currentStock: number;
};

function buildState(r: ResourceTypeRow): EditFormState {
  const { rentalHours, syncRentalWindows } = rentalHoursStringsFromApi(
    r.rentalWindows
  );
  return {
    name: r.name,
    notes: r.notes ?? "",
    active: r.active,
    sortOrder: r.sortOrder,
    assignmentStrategy:
      r.assignmentStrategy === "auto" ? "auto" : "manual",
    totalUnits: r.totalUnits ?? 1,
    rentalHours,
    syncRentalWindows,
    turnaroundBufferMinutes: r.turnaroundBufferMinutes,
    trackInventory: r.trackInventory,
    currentStock: r.currentStock ?? 0,
  };
}

function AssignmentCard({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col rounded-xl border-2 px-3 py-3 text-left sm:min-h-[88px]",
        selected
          ? "border-fairway bg-[var(--rental-tint)]"
          : "border-stone bg-white hover:border-grass"
      )}
    >
      <span
        className={cn(
          "text-[13px] font-semibold",
          selected ? "text-fairway" : "text-ink"
        )}
      >
        {title}
      </span>
      <span
        className={cn(
          "mt-1.5 text-[11px] leading-snug",
          selected ? "text-fairway/90" : "text-muted"
        )}
      >
        {description}
      </span>
    </button>
  );
}

export function ResourceEditDialog({
  resource,
  clubId,
  onClose,
  onSaved,
}: {
  resource: ResourceTypeRow;
  clubId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditFormState>(() => buildState(resource));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");

  const patch = useCallback((p: Partial<EditFormState>) => {
    setForm((f) => (f ? { ...f, ...p } : f));
    if (p.name !== undefined) setNameError("");
  }, []);

  const setAllRentalHours = useCallback(
    (value: string) => {
      setForm((f) => {
        if (!f) return f;
        const rentalHours: Record<string, string> = {};
        for (const k of WINDOW_KEYS) rentalHours[k] = value;
        return { ...f, rentalHours };
      });
    },
    []
  );

  const save = useCallback(async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      setNameError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    setNameError("");
    try {
      const body: Record<string, unknown> = {
        name,
        notes: form.notes.trim() || null,
        active: form.active,
        sortOrder: form.sortOrder,
      };

      if (resource.usageModel === "rental") {
        body.assignmentStrategy =
          resource.trackingMode === "pool"
            ? "none"
            : form.assignmentStrategy;
        if (resource.trackingMode === "pool") {
          body.totalUnits = form.totalUnits;
        }
        body.rentalWindows = rentalWindowsPayloadFromForm(form.rentalHours);
        body.turnaroundBufferMinutes = form.turnaroundBufferMinutes;
      } else if (resource.usageModel === "consumable") {
        body.trackInventory = form.trackInventory;
        body.currentStock = form.trackInventory ? form.currentStock : null;
      }

      const res = await fetch(
        `/api/clubs/${clubId}/resources/${resource.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error ?? "Could not save changes"
        );
        return;
      }

      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [clubId, form, onClose, onSaved, resource]);

  const activeListedHelper =
    resource.usageModel === "service"
      ? "Inactive hides this service where bookings apply."
      : "Inactive items may be hidden from golfer-facing flows.";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[520px] gap-0 overflow-y-auto rounded-2xl border-stone bg-warm-white p-0 shadow-card sm:max-w-[520px]">
        <DialogHeader className="border-b border-stone py-4 pl-5 pr-12 text-left sm:py-[17px] sm:pl-[22px] sm:pr-14">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1 pr-1">
              <DialogTitle className="font-display text-[17px] font-normal text-ink">
                Edit details
              </DialogTitle>
              <DialogDescription className="text-[13px] text-muted">
                {resource.name} ·{" "}
                {resource.usageModel === "rental"
                  ? "Rental"
                  : resource.usageModel === "consumable"
                    ? "Inventory"
                    : "Service"}
                {resource.usageModel === "rental" && resource.trackingMode
                  ? ` · ${resource.trackingMode === "pool" ? "Pool" : "Individual"}`
                  : null}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2.5 sm:pt-0.5">
              <span id="edit-active-hint" className="sr-only">
                {activeListedHelper}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  id="edit-active-label"
                  className="text-[12px] font-medium text-ink"
                >
                  Listed
                </span>
                <span className="group/listed-help relative inline-flex shrink-0">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    className="flex h-5 w-5 shrink-0 cursor-default items-center justify-center rounded-full border border-stone/90 bg-cream/80 text-[11px] font-bold leading-none text-muted transition hover:border-grass hover:text-ink"
                  >
                    ?
                  </button>
                  <span
                    aria-hidden
                    className="pointer-events-none invisible absolute right-0 top-[calc(100%+6px)] z-[100] w-max max-w-[260px] rounded-md border border-stone bg-ink px-3 py-1.5 text-left text-xs leading-snug text-warm-white opacity-0 shadow-md transition-opacity duration-150 [@media(hover:hover)]:group-hover/listed-help:visible [@media(hover:hover)]:group-hover/listed-help:opacity-100"
                  >
                    {activeListedHelper}
                  </span>
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.active}
                aria-labelledby="edit-active-label"
                aria-describedby="edit-active-hint"
                onClick={() => patch({ active: !form.active })}
                className={cn(
                  "flex h-7 w-[46px] shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass/35 focus-visible:ring-offset-2 focus-visible:ring-offset-warm-white",
                  form.active
                    ? "justify-end bg-fairway"
                    : "justify-start bg-stone/45"
                )}
              >
                <span
                  className="h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5"
                  aria-hidden
                />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[min(60vh,520px)] overflow-y-auto px-5 py-5 sm:px-[22px]">
          <div className="space-y-8">
          <div>
            <label className={labelCls} htmlFor="edit-name">
              Name
            </label>
            <input
              id="edit-name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              className={cn(inputCls, nameError && inputErr)}
              aria-invalid={nameError ? true : undefined}
            />
            {nameError ? (
              <p className="mt-1 text-xs font-medium text-red-700">{nameError}</p>
            ) : null}
          </div>

          {resource.usageModel === "rental" ? (
            <>
              <div>
                <p className={labelCls}>Rental mode</p>
                <p className="rounded-lg border border-stone bg-cream/60 px-3 py-2 text-[13px] text-ink">
                  {resource.trackingMode === "pool"
                    ? "Pool — shared fleet count with maintenance holds."
                    : "Individual — each unit tracked separately."}
                </p>
              </div>

              {resource.trackingMode === "individual" ? (
                <div>
                  <p className={labelCls}>Assignment</p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <AssignmentCard
                      selected={form.assignmentStrategy === "auto"}
                      onSelect={() => patch({ assignmentStrategy: "auto" })}
                      title="Auto"
                      description="System picks an available unit when the booking is placed."
                    />
                    <AssignmentCard
                      selected={form.assignmentStrategy === "manual"}
                      onSelect={() => patch({ assignmentStrategy: "manual" })}
                      title="Manual"
                      description="Staff assigns a specific unit at check-in or handoff."
                    />
                  </div>
                </div>
              ) : null}

              {resource.trackingMode === "pool" ? (
                <div>
                  <label className={labelCls} htmlFor="edit-units">
                    Total units
                  </label>
                  <input
                    id="edit-units"
                    type="number"
                    min={1}
                    value={form.totalUnits}
                    onChange={(e) =>
                      patch({ totalUnits: Number(e.target.value) || 1 })
                    }
                    className={inputCls}
                  />
                </div>
              ) : null}

              <div>
                <p className={labelCls}>Rental duration (hours)</p>
                <p className="mb-3 text-[11px] leading-relaxed text-muted">
                  Stored as minutes on the server; edit in hours here.
                </p>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-stone/80 bg-cream/50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone text-fairway focus:ring-fairway"
                    checked={form.syncRentalWindows}
                    onChange={(e) => {
                      const sync = e.target.checked;
                      if (sync) {
                        const v = form.rentalHours.default ?? "4.5";
                        const rentalHours: Record<string, string> = {};
                        for (const k of WINDOW_KEYS) rentalHours[k] = v;
                        patch({ syncRentalWindows: true, rentalHours });
                      } else {
                        patch({ syncRentalWindows: false });
                      }
                    }}
                  />
                  <span>
                    <span className="text-[13px] font-medium text-ink">
                      Same duration for all round lengths
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      One value copied to every window key the API expects.
                    </span>
                  </span>
                </label>

                {form.syncRentalWindows ? (
                  <div className="mt-4">
                    <label className={labelCls} htmlFor="edit-hours-sync">
                      Hours
                    </label>
                    <input
                      id="edit-hours-sync"
                      type="text"
                      inputMode="decimal"
                      value={form.rentalHours.default ?? ""}
                      onChange={(e) => setAllRentalHours(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-stone bg-white">
                    <table className="w-full min-w-[340px] border-collapse text-center text-[12px]">
                      <thead>
                        <tr className="border-b border-stone bg-cream">
                          {WINDOW_KEYS.map((k) => (
                            <th
                              key={k}
                              className="px-1.5 py-2 font-semibold text-muted"
                            >
                              {HOLE_LABELS[k]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {WINDOW_KEYS.map((k) => (
                            <td key={k} className="p-1.5">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={form.rentalHours[k] ?? ""}
                                onChange={(e) =>
                                  patch({
                                    rentalHours: {
                                      ...form.rentalHours,
                                      [k]: e.target.value,
                                    },
                                  })
                                }
                                className="w-full min-w-0 rounded border border-stone px-1 py-1.5 text-center text-[13px] focus:border-grass focus:outline-none"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}

          {resource.usageModel === "consumable" ? (
            <>
              <div>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-stone/80 bg-cream/50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone text-fairway focus:ring-fairway"
                    checked={form.trackInventory}
                    onChange={(e) =>
                      patch({ trackInventory: e.target.checked })
                    }
                  />
                  <span>
                    <span className="text-[13px] font-medium text-ink">
                      Track inventory
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      When off, stock is unlimited and not shown on cards.
                    </span>
                  </span>
                </label>
              </div>
              {form.trackInventory ? (
                <div>
                  <label className={labelCls} htmlFor="edit-stock">
                    Current stock
                  </label>
                  <input
                    id="edit-stock"
                    type="number"
                    min={0}
                    value={form.currentStock}
                    onChange={(e) =>
                      patch({
                        currentStock: Number(e.target.value) || 0,
                      })
                    }
                    className={inputCls}
                  />
                </div>
              ) : null}
            </>
          ) : null}

          <div>
            <label className={labelCls} htmlFor="edit-notes">
              Notes
            </label>
            <textarea
              id="edit-notes"
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={3}
              className={cn(inputCls, "resize-y")}
            />
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-4",
              resource.usageModel === "rental" && "sm:grid-cols-2"
            )}
          >
            {resource.usageModel === "rental" ? (
              <div className="flex min-w-0 flex-col">
                <label className={labelCls} htmlFor="edit-turn">
                  Turnaround buffer (minutes)
                </label>
                <input
                  id="edit-turn"
                  type="number"
                  min={0}
                  value={form.turnaroundBufferMinutes}
                  onChange={(e) =>
                    patch({
                      turnaroundBufferMinutes:
                        Number(e.target.value) || 0,
                    })
                  }
                  className={inputCls}
                />
              </div>
            ) : null}

            <div className="flex min-w-0 flex-col">
              <label className={labelCls} htmlFor="edit-sort">
                Sort order
              </label>
              <input
                id="edit-sort"
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  patch({ sortOrder: Number(e.target.value) || 0 })
                }
                className={inputCls}
              />
              <p className="mt-1 text-[10px] leading-snug text-muted">
                Lower numbers appear first in lists.
              </p>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          </div>
        </div>

        <DialogFooter className="border-t border-stone px-5 py-3.5 sm:px-[22px]">
          <Button
            type="button"
            variant="outline"
            className="border-stone"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-fairway hover:bg-fairway/90"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
