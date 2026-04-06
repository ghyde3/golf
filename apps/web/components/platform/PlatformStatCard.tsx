import { cn } from "@/lib/utils";

export function PlatformStatCard({
  label,
  value,
  borderClass,
}: {
  label: string;
  value: string | number;
  borderClass: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-stone bg-white p-4 shadow-sm border-t-2",
        borderClass
      )}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}
