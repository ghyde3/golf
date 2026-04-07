"use client";

import type { ResourceTypeRow } from "@/lib/resource-types";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@/lib/resource-types";
import { cn } from "@/lib/utils";
import { useCallback, type KeyboardEvent } from "react";

function accentClass(t: ResourceTypeRow): string {
  if (t.usageModel === "rental") return "bg-fairway";
  if (t.usageModel === "consumable") return "bg-gold";
  return "bg-[color:var(--service-accent)]";
}

function typeCol(t: ResourceTypeRow): string {
  if (t.usageModel === "rental" && t.trackingMode === "pool") return "Pool";
  if (t.usageModel === "rental" && t.trackingMode === "individual")
    return "Individual";
  if (t.usageModel === "consumable") return "Consumable";
  return "Service";
}

function subText(t: ResourceTypeRow): string {
  if (t.usageModel === "rental" && t.trackingMode === "pool") return "Pool";
  if (t.usageModel === "rental" && t.trackingMode === "individual") {
    return `Individual · ${t.assignmentStrategy === "auto" ? "auto" : "manual"}`;
  }
  if (t.usageModel === "consumable") {
    const stock = t.currentStock ?? 0;
    if (t.trackInventory && stock <= DEFAULT_LOW_STOCK_THRESHOLD) {
      return `⚠ Below threshold (${DEFAULT_LOW_STOCK_THRESHOLD})`;
    }
    return `Restock at ${DEFAULT_LOW_STOCK_THRESHOLD}`;
  }
  return t.notes?.trim() || "Manual availability";
}

function metricCell(t: ResourceTypeRow): { text: string; low: boolean } {
  if (t.usageModel === "rental") {
    return { text: String(t.availableNow ?? 0), low: false };
  }
  if (t.usageModel === "consumable" && t.trackInventory) {
    const stock = t.currentStock ?? 0;
    return {
      text: String(stock),
      low: stock <= DEFAULT_LOW_STOCK_THRESHOLD,
    };
  }
  if (t.usageModel === "consumable") return { text: "—", low: false };
  return { text: t.active ? "Manual" : "Off", low: !t.active };
}

type StatusKind = "available" | "low" | "maintenance" | "unavailable";

function rowStatus(t: ResourceTypeRow): { kind: StatusKind; label: string } {
  if (t.usageModel === "service") {
    return t.active
      ? { kind: "available", label: "Available" }
      : { kind: "unavailable", label: "Unavailable" };
  }
  if (t.usageModel === "consumable" && t.trackInventory) {
    const stock = t.currentStock ?? 0;
    if (stock <= DEFAULT_LOW_STOCK_THRESHOLD)
      return { kind: "low", label: "Low stock" };
    return { kind: "available", label: "In stock" };
  }
  if (t.usageModel === "consumable") {
    return { kind: "available", label: "Not tracked" };
  }
  const avail = t.availableNow ?? 0;
  const maint = t.inMaintenance;
  if (maint > 0 && avail === 0) return { kind: "maintenance", label: "Maintenance" };
  if (maint > 0) return { kind: "maintenance", label: "Partial" };
  return { kind: "available", label: "Available" };
}

function statusColor(kind: StatusKind): string {
  switch (kind) {
    case "available":
      return "text-[color:var(--status-available)]";
    case "low":
      return "text-[color:var(--status-low)]";
    case "maintenance":
      return "text-[color:var(--status-maintenance)]";
    default:
      return "text-[color:var(--status-unavailable)]";
  }
}

function dotBg(kind: StatusKind): string {
  switch (kind) {
    case "available":
      return "bg-[color:var(--status-available)]";
    case "low":
      return "bg-[color:var(--status-low)]";
    case "maintenance":
      return "bg-[color:var(--status-maintenance)]";
    default:
      return "bg-[color:var(--status-unavailable)]";
  }
}

export type ResourceListRowProps = {
  resource: ResourceTypeRow;
  onOpen: (id: string) => void;
  onRestock: (id: string) => void;
};

export function ResourceListRow({
  resource: t,
  onOpen,
  onRestock,
}: ResourceListRowProps) {
  const m = metricCell(t);
  const st = rowStatus(t);

  const open = useCallback(() => onOpen(t.id), [onOpen, t.id]);
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    },
    [open]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKey}
      className="grid cursor-pointer grid-cols-[3px_1fr_110px_110px_110px_130px] items-center overflow-hidden rounded-[9px] border border-stone bg-white transition hover:bg-cream"
    >
      <span className={cn("min-h-[52px] self-stretch", accentClass(t))} />
      <div className="flex flex-col gap-0.5 px-3.5 py-2.5">
        <span className="text-[13px] font-semibold text-ink">{t.name}</span>
        <span className="text-[10px] text-muted">{subText(t)}</span>
      </div>
      <div className="px-2.5 py-2.5 text-[12px] text-muted">{typeCol(t)}</div>
      <div
        className={cn(
          "px-2.5 py-2.5 text-[12px] text-muted",
          m.low && "font-semibold text-[color:var(--status-low)]"
        )}
      >
        <strong className="font-semibold text-ink">{m.text}</strong>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-2.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotBg(st.kind))} />
        <span
          className={cn("text-[11px] font-semibold", statusColor(st.kind))}
        >
          {st.label}
        </span>
      </div>
      <div
        className="flex justify-end gap-1.5 px-3 py-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {t.usageModel === "consumable" && t.trackInventory ? (
          <button
            type="button"
            onClick={() => onRestock(t.id)}
            className="rounded-md border border-fairway/30 bg-white px-2 py-1 text-[11px] font-semibold text-fairway"
          >
            Restock
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onOpen(t.id)}
          className="rounded-md border border-stone bg-white px-2 py-1 text-[11px] font-semibold text-muted hover:text-ink"
        >
          View
        </button>
      </div>
    </div>
  );
}
