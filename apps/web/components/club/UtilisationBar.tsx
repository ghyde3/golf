import { cn } from "@/lib/utils";

export function UtilisationBar({
  name,
  pct,
  booked,
  total,
}: {
  name: string;
  pct: number;
  booked: number;
  total: number;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const barClass =
    clamped >= 100
      ? "bg-red-400"
      : clamped >= 30
        ? "bg-gold"
        : "bg-grass";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{name}</span>
        <span className="font-mono text-sm text-ink">{Math.round(clamped)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone/80">
        <div
          className={cn("h-full rounded-full transition-all", barClass)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-xs text-muted">
        {booked} of {total} slots booked
      </p>
    </div>
  );
}
