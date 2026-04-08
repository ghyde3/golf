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
import type { ResourceTypeRow } from "@/lib/resource-types";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AddonCatalogRow } from "./page";

export function AddonsClient({
  clubId,
  initialAddons,
  resourceTypes,
}: {
  clubId: string;
  initialAddons: AddonCatalogRow[];
  resourceTypes: ResourceTypeRow[];
}) {
  const [rows, setRows] = useState(initialAddons);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newTaxable, setNewTaxable] = useState(true);
  const [newRt, setNewRt] = useState<string>("");
  const [newUnits, setNewUnits] = useState("1");
  const [newSort, setNewSort] = useState("0");

  const rtOptions = useMemo(
    () =>
      resourceTypes
        .filter((r) => r.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [resourceTypes]
  );

  const reload = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/addons`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as AddonCatalogRow[];
    setRows(Array.isArray(data) ? data : []);
  }, [clubId]);

  async function patchItem(
    id: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    setSaving(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/addons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        toast.error("Could not save");
        return;
      }
      await reload();
      toast.success("Saved");
    } finally {
      setSaving(false);
    }
  }

  async function createItem() {
    const price = Number.parseFloat(newPrice);
    if (!newName.trim() || Number.isNaN(price) || price < 0) {
      toast.error("Name and valid price required");
      return;
    }
    const units = Number.parseInt(newUnits, 10);
    const sort = Number.parseInt(newSort, 10);
    setSaving(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/addons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          priceCents: Math.round(price * 100),
          taxable: newTaxable,
          resourceTypeId: newRt || null,
          unitsConsumed: Number.isFinite(units) && units > 0 ? units : 1,
          sortOrder: Number.isFinite(sort) ? sort : 0,
          active: true,
        }),
      });
      if (!res.ok) {
        toast.error("Could not create");
        return;
      }
      setAddOpen(false);
      setNewName("");
      setNewDesc("");
      setNewPrice("");
      setNewRt("");
      setNewUnits("1");
      setNewSort("0");
      await reload();
      toast.success("Add-on created");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Add-ons</h1>
          <p className="mt-1 text-sm text-muted">
            Upsells shown during online booking and available on the tee sheet.
          </p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          Add item
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-stone bg-cream/50 text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Inventory</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Sort</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No add-ons yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-stone/80">
                  <td className="px-4 py-3">
                    <Input
                      defaultValue={r.name}
                      className="h-8 max-w-[220px]"
                      disabled={saving}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== r.name) void patchItem(r.id, { name: v });
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      className="h-8 w-24 font-mono"
                      defaultValue={(r.priceCents / 100).toFixed(2)}
                      disabled={saving}
                      onBlur={(e) => {
                        const n = Number.parseFloat(e.target.value);
                        if (!Number.isNaN(n) && n >= 0) {
                          const cents = Math.round(n * 100);
                          if (cents !== r.priceCents) {
                            void patchItem(r.id, { priceCents: cents });
                          }
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {r.resourceTypeName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-fairway"
                      checked={r.active}
                      disabled={saving}
                      onChange={(e) =>
                        patchItem(r.id, { active: e.target.checked })
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {r.sortOrder}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New add-on</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase text-muted">
                Name
              </label>
              <Input
                className="mt-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted">
                Description (optional)
              </label>
              <Input
                className="mt-1"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted">
                Price (USD)
              </label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newTaxable}
                onChange={(e) => setNewTaxable(e.target.checked)}
              />
              Taxable
            </label>
            <div>
              <label className="text-xs font-bold uppercase text-muted">
                Resource type (optional)
              </label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-stone bg-warm-white px-3 text-sm"
                value={newRt}
                onChange={(e) => setNewRt(e.target.value)}
              >
                <option value="">— None —</option>
                {rtOptions.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} ({rt.assignmentStrategy})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted">
                Link to inventory for availability and assignments.
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted">
                Units consumed (when resource linked)
              </label>
              <Input
                className="mt-1"
                type="number"
                min={1}
                value={newUnits}
                onChange={(e) => setNewUnits(e.target.value)}
                disabled={!newRt}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted">
                Sort order
              </label>
              <Input
                className="mt-1"
                type="number"
                value={newSort}
                onChange={(e) => setNewSort(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => createItem()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
