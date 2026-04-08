"use client";

import type { ResourceViewMode } from "@/hooks/useResourceView";
import { cn } from "@/lib/utils";
import { Grid3x3, LayoutGrid, List } from "lucide-react";
import type { ReactNode } from "react";

export function ViewToggle({
  view,
  onChange,
}: {
  view: ResourceViewMode;
  onChange: (v: ResourceViewMode) => void;
}) {
  const btn = (mode: ResourceViewMode, icon: ReactNode, title: string) => (
    <button
      type="button"
      title={title}
      aria-pressed={view === mode}
      onClick={() => onChange(mode)}
      className={cn(
        "flex items-center justify-center border-r border-stone px-2.5 py-1.5 transition-colors last:border-r-0",
        view === mode
          ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
          : "bg-transparent hover:bg-white/60"
      )}
    >
      <span
        className={cn(
          "flex h-[14px] w-[14px] items-center justify-center",
          view === mode ? "text-fairway" : "text-muted"
        )}
      >
        {icon}
      </span>
    </button>
  );

  return (
    <div
      className="flex shrink-0 overflow-hidden rounded-lg border border-stone bg-cream"
      role="group"
      aria-label="Resource layout"
    >
      {btn(
        "grouped",
        <LayoutGrid className="h-[14px] w-[14px]" strokeWidth={2} />,
        "Grouped grid — sections by type"
      )}
      {btn(
        "flat",
        <Grid3x3 className="h-[14px] w-[14px]" strokeWidth={2} />,
        "Flat grid — all items with filters"
      )}
      {btn(
        "list",
        <List className="h-[14px] w-[14px]" strokeWidth={2} />,
        "List view — dense table"
      )}
    </div>
  );
}
