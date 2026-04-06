"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { TeeSlotRow } from "./types";

type Props = {
  times: TeeSlotRow[];
  selectedDatetime: string | null;
  onSelect: (slot: TeeSlotRow) => void;
  loading?: boolean;
  emptyMessage?: string;
  /** Dim slots that are not selectable (e.g. already blocked) */
  disabled?: (slot: TeeSlotRow) => boolean;
};

export function TeeTimeChipPicker({
  times,
  selectedDatetime,
  onSelect,
  loading,
  emptyMessage,
  disabled,
}: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-stone bg-cream/40 py-10">
        <p className="text-sm text-muted">Loading times…</p>
      </div>
    );
  }

  if (times.length === 0) {
    return (
      <div className="rounded-xl border border-stone bg-cream/60 px-3 py-3 text-sm text-muted">
        {emptyMessage ?? "No times available."}
      </div>
    );
  }

  return (
    <div
      className="max-h-[min(260px,42vh)] overflow-y-auto rounded-xl border border-stone bg-gradient-to-b from-cream/80 to-warm-white p-2 shadow-inner"
      role="listbox"
      aria-label="Available tee times"
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {times.map((slot) => {
          const selected = selectedDatetime === slot.datetime;
          const isDisabled = disabled?.(slot) ?? false;
          return (
            <button
              key={slot.datetime}
              type="button"
              role="option"
              aria-selected={selected}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              onClick={() => !isDisabled && onSelect(slot)}
              className={cn(
                "min-h-[46px] rounded-lg border px-1.5 py-2 text-center text-sm transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway focus-visible:ring-offset-2",
                isDisabled &&
                  "cursor-not-allowed border-stone/50 bg-stone/30 text-muted opacity-60",
                !isDisabled &&
                  !selected &&
                  "border-stone bg-white text-ink shadow-sm hover:border-fairway/50 hover:bg-cream",
                !isDisabled &&
                  selected &&
                  "border-fairway bg-fairway text-white shadow-md ring-1 ring-fairway/30"
              )}
            >
              <span className="block font-mono tabular-nums leading-tight">
                {format(new Date(slot.datetime), "h:mm a")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
