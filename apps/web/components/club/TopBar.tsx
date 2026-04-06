"use client";

import { useClubTopBar } from "@/components/club/ClubTopBarContext";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, delta: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + delta);
  const ys = dt.getFullYear();
  const ms = String(dt.getMonth() + 1).padStart(2, "0");
  const ds = String(dt.getDate()).padStart(2, "0");
  return `${ys}-${ms}-${ds}`;
}

/** Date nav is only relevant on tee sheet and bookings (not dashboard home, settings, etc.). */
function showDatePickerForPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "club" || parts.length < 3) return false;
  const section = parts[2];
  return section === "teesheet" || section === "bookings";
}

export function TopBar() {
  const { title, actions } = useClubTopBar();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showDatePicker = showDatePickerForPath(pathname);

  const dateStr = searchParams.get("date") ?? todayIsoLocal();

  const label = useMemo(
    () =>
      format(
        new Date(dateStr + "T12:00:00"),
        "EEE, MMM d"
      ),
    [dateStr]
  );

  const pushDate = useCallback(
    (next: string) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("date", next);
      router.push(`${pathname}?${q.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const onPrev = () => pushDate(addDays(dateStr, -1));
  const onNext = () => pushDate(addDays(dateStr, 1));
  const onToday = () => pushDate(todayIsoLocal());

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-stone bg-warm-white px-4 lg:px-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-lg text-ink truncate">{title}</h1>
      </div>
      {showDatePicker ? (
        <div className="flex shrink-0 items-center justify-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 border-stone bg-cream"
            onClick={onPrev}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted tabular-nums whitespace-nowrap px-0.5 sm:px-1 sm:text-sm">
            {label}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 border-stone bg-cream"
            onClick={onNext}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={onToday}
          >
            Today
          </Button>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {actions}
      </div>
    </header>
  );
}
