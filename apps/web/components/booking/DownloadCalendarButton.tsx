"use client";

import { useCallback } from "react";
import ical from "ical-generator";
import { cn } from "@/lib/utils";

interface Props {
  bookingRef: string;
  clubName: string;
  courseName: string;
  datetimeIso: string;
  timezone: string;
  playersCount: number;
  className?: string;
  label?: string;
  /** When true, prefixes the label with "+ " (account / reference design). */
  leadingPlus?: boolean;
}

export function DownloadCalendarButton({
  bookingRef,
  clubName,
  courseName,
  datetimeIso,
  timezone,
  playersCount,
  className,
  label = "Add to calendar",
  leadingPlus = false,
}: Props) {
  const download = useCallback(() => {
    const start = new Date(datetimeIso);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // +2h

    const cal = ical();
    cal.createEvent({
      summary: `Tee time at ${clubName}`,
      start,
      end,
      timezone,
      location: clubName,
      description: `Course: ${courseName}\nPlayers: ${playersCount}\nRef: ${bookingRef}`,
      id: `teetimes-${bookingRef}`,
    });

    const content = cal.toString();
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tee-time-${bookingRef}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [bookingRef, clubName, courseName, datetimeIso, timezone, playersCount]);

  return (
    <button
      type="button"
      onClick={download}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-ds-stone bg-ds-warm-white px-3.5 py-1.5 text-xs font-semibold text-ds-ink transition-colors hover:bg-ds-cream",
        className
      )}
    >
      {leadingPlus ? "+ " : null}
      {label}
    </button>
  );
}
