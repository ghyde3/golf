"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";
import { AddItemWizard } from "@/components/resources/AddItemWizard";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { ResourceCardAdd } from "@/components/resources/ResourceCardAdd";
import { ResourceDrawer } from "@/components/resources/ResourceDrawer";
import { ResourceListRow } from "@/components/resources/ResourceListRow";
import { ViewToggle } from "@/components/resources/ViewToggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useResourceView } from "@/hooks/useResourceView";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  type ResourceTypeRow,
} from "@/lib/resource-types";
import { cn } from "@/lib/utils";
import { Package, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export type { ResourceTypeRow } from "@/lib/resource-types";

function SectionHeader({
  label,
  accentClass,
  count,
  onAdd,
}: {
  label: string;
  accentClass: string;
  count: number;
  onAdd: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.14em]",
          accentClass
        )}
      >
        {label}
      </span>
      <div className="h-px min-w-[40px] flex-1 bg-stone" />
      <span className="text-[11px] text-muted">{count} items</span>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 rounded-md border border-stone bg-white px-2.5 py-1 text-[11px] font-semibold text-fairway"
      >
        <Plus className="h-3 w-3" strokeWidth={2} />
        Add
      </button>
    </div>
  );
}

function ListColumnHeader({ metricLabel }: { metricLabel: string }) {
  return (
    <div className="mb-1 grid grid-cols-[3px_1fr_110px_110px_110px_130px] items-center border-b border-stone pb-2">
      <span />
      <span className="px-3 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
        Item
      </span>
      <span className="px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
        Type
      </span>
      <span className="px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
        {metricLabel}
      </span>
      <span className="px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
        Status
      </span>
      <span className="px-3 text-right text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
        Actions
      </span>
    </div>
  );
}

export function ResourcesClient({
  clubId,
  resources: initial,
}: {
  clubId: string;
  resources: ResourceTypeRow[];
}) {
  const { view, setView } = useResourceView(clubId);
  const [resources, setResources] = useState<ResourceTypeRow[]>(initial);
  const [search, setSearch] = useState("");
  const [flatFilter, setFlatFilter] = useState<
    "all" | "rental" | "consumable" | "service" | "low"
  >("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPreselect, setWizardPreselect] = useState<
    "rental" | "consumable" | "service" | null
  >(null);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState("10");
  const [restockSaving, setRestockSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/resources`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as ResourceTypeRow[];
    setResources(data);
  }, [clubId]);

  const bySearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) => r.name.toLowerCase().includes(q));
  }, [resources, search]);

  const lowStockCount = useMemo(
    () =>
      bySearch.filter(
        (r) =>
          r.usageModel === "consumable" &&
          r.trackInventory &&
          (r.currentStock ?? 0) <= DEFAULT_LOW_STOCK_THRESHOLD
      ).length,
    [bySearch]
  );

  const flatFiltered = useMemo(() => {
    if (flatFilter === "all") return bySearch;
    if (flatFilter === "low") {
      return bySearch.filter(
        (r) =>
          r.usageModel === "consumable" &&
          r.trackInventory &&
          (r.currentStock ?? 0) <= DEFAULT_LOW_STOCK_THRESHOLD
      );
    }
    if (flatFilter === "rental")
      return bySearch.filter((r) => r.usageModel === "rental");
    if (flatFilter === "consumable")
      return bySearch.filter((r) => r.usageModel === "consumable");
    return bySearch.filter((r) => r.usageModel === "service");
  }, [bySearch, flatFilter]);

  const rentals = useMemo(
    () => bySearch.filter((r) => r.usageModel === "rental"),
    [bySearch]
  );
  const inventory = useMemo(
    () => bySearch.filter((r) => r.usageModel === "consumable"),
    [bySearch]
  );
  const services = useMemo(
    () => bySearch.filter((r) => r.usageModel === "service"),
    [bySearch]
  );

  const selectedResource = useMemo(
    () => resources.find((r) => r.id === selectedId) ?? null,
    [resources, selectedId]
  );

  const openWizard = useCallback(
    (pre: "rental" | "consumable" | "service" | null) => {
      setWizardPreselect(pre);
      setWizardOpen(true);
    },
    []
  );

  const submitRestock = useCallback(async () => {
    if (!restockId) return;
    const n = Number(restockQty);
    if (!Number.isFinite(n) || n === 0) return;
    setRestockSaving(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/resources/${restockId}/restock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ deltaQuantity: n, reason: null }),
        }
      );
      if (res.ok) {
        setRestockId(null);
        await refresh();
      }
    } finally {
      setRestockSaving(false);
    }
  }, [clubId, restockId, restockQty, refresh]);

  const topActions = useMemo(
    () => (
      <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
        <ViewToggle view={view} onChange={setView} />
        <label className="relative flex min-w-[140px] max-w-[220px] flex-1 items-center gap-2 rounded-lg border border-stone bg-white px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
          />
        </label>
        <Button
          type="button"
          size="sm"
          className="shrink-0 bg-fairway hover:bg-fairway/90"
          onClick={() => openWizard(null)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} />
          Add item
        </Button>
      </div>
    ),
    [view, setView, search, openWizard]
  );

  const empty = resources.length === 0;

  return (
    <>
      <SetTopBar title="Resources" actions={topActions} />
      <div className="flex h-full flex-col overflow-y-auto px-4 py-5 lg:px-6">
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
            <Package className="h-14 w-14 text-muted/50" strokeWidth={1.25} />
            <div>
              <p className="font-display text-lg text-ink">No items yet</p>
              <p className="mt-2 max-w-sm text-sm text-muted">
                Add your first rental, inventory item, or service to get
                started.
              </p>
            </div>
            <Button
              type="button"
              className="bg-fairway hover:bg-fairway/90"
              onClick={() => openWizard(null)}
            >
              Add first item
            </Button>
          </div>
        ) : (
          <>
            {view === "flat" ? (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "All items"],
                    ["rental", "Rentals"],
                    ["consumable", "Inventory"],
                    ["service", "Services"],
                    ...(lowStockCount > 0
                      ? ([["low", `Low stock (${lowStockCount})`]] as const)
                      : []),
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFlatFilter(id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                      flatFilter === id
                        ? id === "rental"
                          ? "border-fairway bg-fairway text-white"
                          : id === "consumable"
                            ? "border-[color:var(--tag-gold-fg)] bg-[color:var(--tag-gold-fg)] text-white"
                            : id === "service"
                              ? "border-[color:var(--service-accent)] bg-[color:var(--service-accent)] text-white"
                              : id === "low"
                                ? "border-amber-600 bg-amber-500 text-white"
                                : "border-ink bg-ink text-white"
                        : "border-stone bg-white text-muted hover:border-grass hover:text-fairway"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            {view === "grouped" ? (
              <div className="space-y-8">
                <section>
                  <SectionHeader
                    label="Rentals"
                    accentClass="text-fairway"
                    count={rentals.length}
                    onAdd={() => openWizard("rental")}
                  />
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {rentals.map((t) => (
                      <ResourceCard
                        key={t.id}
                        resource={t}
                        viewMode="grouped"
                        onOpen={setSelectedId}
                        onRestock={setRestockId}
                      />
                    ))}
                    <ResourceCardAdd
                      section="rental"
                      onAdd={(s) => openWizard(s)}
                    />
                  </div>
                </section>
                <section>
                  <SectionHeader
                    label="Inventory"
                    accentClass="text-[color:var(--tag-gold-fg)]"
                    count={inventory.length}
                    onAdd={() => openWizard("consumable")}
                  />
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {inventory.map((t) => (
                      <ResourceCard
                        key={t.id}
                        resource={t}
                        viewMode="grouped"
                        onOpen={setSelectedId}
                        onRestock={setRestockId}
                      />
                    ))}
                    <ResourceCardAdd
                      section="consumable"
                      onAdd={(s) => openWizard(s)}
                    />
                  </div>
                </section>
                <section>
                  <SectionHeader
                    label="Services"
                    accentClass="text-[color:var(--service-accent)]"
                    count={services.length}
                    onAdd={() => openWizard("service")}
                  />
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {services.map((t) => (
                      <ResourceCard
                        key={t.id}
                        resource={t}
                        viewMode="grouped"
                        onOpen={setSelectedId}
                        onRestock={setRestockId}
                      />
                    ))}
                    <ResourceCardAdd
                      section="service"
                      onAdd={(s) => openWizard(s)}
                    />
                  </div>
                </section>
              </div>
            ) : null}

            {view === "flat" ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {flatFiltered.map((t) => (
                  <ResourceCard
                    key={t.id}
                    resource={t}
                    viewMode="flat"
                    onOpen={setSelectedId}
                    onRestock={setRestockId}
                  />
                ))}
                <ResourceCardAdd section={null} onAdd={(s) => openWizard(s)} />
              </div>
            ) : null}

            {view === "list" ? (
              <div className="space-y-8">
                <section>
                  <SectionHeader
                    label="Rentals"
                    accentClass="text-fairway"
                    count={rentals.length}
                    onAdd={() => openWizard("rental")}
                  />
                  <ListColumnHeader metricLabel="Available" />
                  <div className="flex flex-col gap-1.5">
                    {rentals.map((t) => (
                      <ResourceListRow
                        key={t.id}
                        resource={t}
                        onOpen={setSelectedId}
                        onRestock={setRestockId}
                      />
                    ))}
                  </div>
                </section>
                <section>
                  <SectionHeader
                    label="Inventory"
                    accentClass="text-[color:var(--tag-gold-fg)]"
                    count={inventory.length}
                    onAdd={() => openWizard("consumable")}
                  />
                  <ListColumnHeader metricLabel="Stock" />
                  <div className="flex flex-col gap-1.5">
                    {inventory.map((t) => (
                      <ResourceListRow
                        key={t.id}
                        resource={t}
                        onOpen={setSelectedId}
                        onRestock={setRestockId}
                      />
                    ))}
                  </div>
                </section>
                <section>
                  <SectionHeader
                    label="Services"
                    accentClass="text-[color:var(--service-accent)]"
                    count={services.length}
                    onAdd={() => openWizard("service")}
                  />
                  <ListColumnHeader metricLabel="Availability" />
                  <div className="flex flex-col gap-1.5">
                    {services.map((t) => (
                      <ResourceListRow
                        key={t.id}
                        resource={t}
                        onOpen={setSelectedId}
                        onRestock={setRestockId}
                      />
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </div>

      <ResourceDrawer
        resourceId={selectedId}
        resource={selectedResource}
        clubId={clubId}
        onClose={() => setSelectedId(null)}
        onUpdated={() => void refresh()}
      />

      <AddItemWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => void refresh()}
        clubId={clubId}
        preselectedType={wizardPreselect}
      />

      <Dialog
        open={restockId !== null}
        onOpenChange={(o) => !o && setRestockId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restock</DialogTitle>
          </DialogHeader>
          <div>
            <label className="mb-1 block text-xs text-muted">
              Quantity to add
            </label>
            <input
              type="number"
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              className="w-full rounded-lg border border-stone px-3 py-2 text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRestockId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-fairway hover:bg-fairway/90"
              disabled={restockSaving}
              onClick={() => void submitRestock()}
            >
              {restockSaving ? "Adding…" : "Add stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
