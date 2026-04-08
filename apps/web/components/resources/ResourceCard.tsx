"use client";

import type { ResourceTypeRow } from "@/lib/resource-types";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@/lib/resource-types";
import { cn } from "@/lib/utils";
import { useCallback, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

type ViewMode = "grouped" | "flat";

function typeBadgeGrouped(t: ResourceTypeRow): string {
  if (t.usageModel === "rental" && t.trackingMode === "pool") return "Pool";
  if (t.usageModel === "rental" && t.trackingMode === "individual") {
    const a =
      t.assignmentStrategy === "auto" ? "Auto" : "Manual";
    return `Individual · ${a}`;
  }
  if (t.usageModel === "consumable") return "Consumable";
  return "Service";
}

function typeBadgeFlat(t: ResourceTypeRow): string {
  if (t.usageModel === "rental" && t.trackingMode === "pool") return "Rental · Pool";
  if (t.usageModel === "rental" && t.trackingMode === "individual") {
    const a =
      t.assignmentStrategy === "auto" ? "Auto" : "Manual";
    return `Rental · Individual · ${a}`;
  }
  if (t.usageModel === "consumable") return "Inventory";
  return "Service";
}

function badgeStyle(t: ResourceTypeRow): string {
  if (t.usageModel === "rental")
    return "bg-[var(--rental-tint)] text-fairway";
  if (t.usageModel === "consumable")
    return "bg-[var(--inventory-tint)] text-[color:var(--tag-gold-fg)]";
  return "bg-[var(--service-tint)] text-[color:var(--service-accent)]";
}

function accentBarClass(t: ResourceTypeRow): string {
  if (t.usageModel === "rental") return "bg-fairway";
  if (t.usageModel === "consumable") return "bg-gold";
  return "bg-[color:var(--service-accent)]";
}

type DotKind = "available" | "low" | "maintenance" | "unavailable";

function statusDotKind(t: ResourceTypeRow): DotKind {
  if (t.usageModel === "service") {
    return t.active ? "available" : "unavailable";
  }
  if (t.usageModel === "consumable") {
    if (!t.trackInventory) return "available";
    const stock = t.currentStock ?? 0;
    if (stock <= DEFAULT_LOW_STOCK_THRESHOLD) return "low";
    return "available";
  }
  const avail = t.availableNow ?? 0;
  const maint = t.inMaintenance;
  if (maint > 0 && avail > 0) return "maintenance";
  if (avail === 0 && maint > 0) return "maintenance";
  if (avail === 0 && maint === 0) return "maintenance";
  return "available";
}

function dotClass(kind: DotKind): string {
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

function metricTone(t: ResourceTypeRow, dot: DotKind): "normal" | "low" | "maintenance" {
  if (t.usageModel === "consumable" && t.trackInventory) {
    const stock = t.currentStock ?? 0;
    if (stock <= DEFAULT_LOW_STOCK_THRESHOLD) return "low";
  }
  if (dot === "maintenance" && t.usageModel !== "consumable") return "maintenance";
  if (dot === "low") return "low";
  return "normal";
}

export type ResourceCardProps = {
  resource: ResourceTypeRow;
  onOpen: (id: string) => void;
  viewMode: ViewMode;
  onRestock?: (id: string) => void;
};

export function ResourceCard({
  resource: t,
  onOpen,
  viewMode,
  onRestock,
}: ResourceCardProps) {
  const dot = statusDotKind(t);
  const tone = metricTone(t, dot);

  const metricClass = cn(
    "font-display text-2xl font-bold leading-none text-ink",
    tone === "low" && "text-[color:var(--status-low)]",
    tone === "maintenance" && "text-[color:var(--status-maintenance)]"
  );

  const onRestockClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onRestock?.(t.id);
    },
    [onRestock, t.id]
  );

  const open = useCallback(() => {
    onOpen(t.id);
  }, [onOpen, t.id]);

  const onKeyCard = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    },
    [open]
  );

  let metric: ReactNode = null;
  if (t.usageModel === "rental" && t.trackingMode === "pool") {
    metric = (
      <>
        <p className={metricClass}>{t.availableNow ?? 0}</p>
        <p className="text-[11px] text-muted">available</p>
      </>
    );
  } else if (t.usageModel === "rental" && t.trackingMode === "individual") {
    metric = (
      <>
        <p className={metricClass}>{t.availableNow ?? 0}</p>
        <p className="text-[11px] text-muted">
          of {t.totalUnits ?? 0} available
        </p>
      </>
    );
  } else if (t.usageModel === "consumable") {
    if (!t.trackInventory) {
      metric = (
        <p className="font-display text-sm font-semibold text-muted">
          Not tracked
        </p>
      );
    } else {
      metric = (
        <>
          <p className={metricClass}>{t.currentStock ?? 0}</p>
          <p className="text-[11px] text-muted">in stock</p>
        </>
      );
    }
  } else {
    metric = (
      <p
        className={cn(
          "mt-1 font-display text-sm font-semibold text-[color:var(--service-accent)]",
          !t.active && "text-[color:var(--status-unavailable)]"
        )}
      >
        {t.active ? "Manual" : "Unavailable"}
      </p>
    );
  }

  const badgeText =
    viewMode === "grouped" ? typeBadgeGrouped(t) : typeBadgeFlat(t);

  let footer: ReactNode = null;
  if (t.usageModel === "rental" && t.trackingMode === "pool") {
    footer = (
      <p className="text-[10px] text-muted">
        <span className="font-semibold text-ink">{t.inMaintenance}</span>{" "}
        maintenance ·{" "}
        <span className="font-semibold text-ink">
          {t.activeHoldsCount ?? 0}
        </span>{" "}
        hold
      </p>
    );
  } else if (t.usageModel === "rental" && t.trackingMode === "individual") {
    footer = (
      <p
        className={cn(
          "text-[10px] text-muted",
          t.inMaintenance > 0 && "text-[color:var(--status-low)]"
        )}
      >
        <span className="font-semibold text-ink">{t.inMaintenance}</span> in
        maintenance
      </p>
    );
  } else if (t.usageModel === "consumable") {
    footer = (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-muted">
          Restock below{" "}
          <span className="font-semibold text-ink">
            {DEFAULT_LOW_STOCK_THRESHOLD}
          </span>{" "}
          units
        </p>
        {t.trackInventory && onRestock ? (
          <button
            type="button"
            onClick={onRestockClick}
            className="shrink-0 rounded border border-fairway/30 bg-white px-2 py-0.5 text-[10px] font-semibold text-fairway"
          >
            Restock
          </button>
        ) : null}
      </div>
    );
  } else {
    footer = (
      <p className="line-clamp-2 text-[10px] text-muted">
        {t.notes?.trim() || "\u00a0"}
      </p>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyCard}
      className={cn(
        "relative w-full cursor-pointer overflow-hidden rounded-[11px] border border-stone bg-white text-left transition hover:-translate-y-px hover:border-stone hover:shadow-md",
        !t.active && "opacity-90"
      )}
    >
      {t.overAllocated ? (
        <div className="bg-[color:var(--status-maintenance)] px-2 py-1 text-center text-[10px] font-semibold text-white">
          Over-allocated
        </div>
      ) : null}
      <span
        className={cn("absolute bottom-0 left-0 top-0 w-[3px]", accentBarClass(t))}
        aria-hidden
      />
      <div className="px-[13px] pb-[11px] pl-[17px] pt-[13px]">
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="flex-1 text-[13px] font-semibold leading-snug text-ink">
            {t.name}
          </p>
          <span
            className={cn(
              "mt-0.5 h-[7px] w-[7px] shrink-0 rounded-full",
              dotClass(dot)
            )}
            title="Status"
          />
        </div>
        <span
          className={cn(
            "mb-2.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em]",
            badgeStyle(t)
          )}
        >
          {badgeText}
        </span>
        <div className="mb-1">{metric}</div>
      </div>
      <div className="border-t border-stone bg-cream px-[13px] py-[7px] pl-[17px] pb-2">
        {footer}
      </div>
    </div>
  );
}
