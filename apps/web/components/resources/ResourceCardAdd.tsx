"use client";

import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export type ResourceCardAddProps = {
  section?: "rental" | "consumable" | "service" | null;
  onAdd: (preselectedType: "rental" | "consumable" | "service" | null) => void;
};

const labelFor = (
  section: ResourceCardAddProps["section"]
): string => {
  if (section === "rental") return "Add rental";
  if (section === "consumable") return "Add inventory";
  if (section === "service") return "Add service";
  return "Add item";
};

export function ResourceCardAdd({ section, onAdd }: ResourceCardAddProps) {
  return (
    <button
      type="button"
      onClick={() => onAdd(section ?? null)}
      className={cn(
        "flex min-h-[120px] w-full flex-col items-center justify-center gap-1.5 rounded-[11px] border-[1.5px] border-dashed border-stone bg-cream px-3 py-4 text-muted transition hover:border-grass hover:bg-[#f0fdf4] hover:text-fairway"
      )}
    >
      <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
      <span className="text-[11px] font-semibold">{labelFor(section)}</span>
    </button>
  );
}
