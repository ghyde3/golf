import { cn } from "@/lib/utils";

export type SlotStatus =
  | "confirmed"
  | "checked-in"
  | "no-show"
  | "blocked"
  | "open";

const styles: Record<SlotStatus, string> = {
  confirmed: "bg-green-50 text-green-700",
  "checked-in": "bg-emerald-50 text-emerald-800",
  "no-show": "bg-red-50 text-red-700",
  blocked: "bg-amber-50 text-amber-700",
  open: "bg-stone-100 text-stone-500",
};

const labels: Record<SlotStatus, string> = {
  confirmed: "Booked",
  "checked-in": "Checked in",
  "no-show": "No-show",
  blocked: "Blocked",
  open: "Open",
};

export function StatusBadge({
  status,
  className,
  label,
}: {
  status: SlotStatus;
  className?: string;
  /** When set, overrides the default label for this status (e.g. platform club status). */
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        styles[status],
        className
      )}
    >
      {label ?? labels[status]}
    </span>
  );
}
