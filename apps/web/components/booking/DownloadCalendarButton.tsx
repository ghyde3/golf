"use client";

import { useCallback } from "react";
import ical from "ical-generator";

interface Props {
  bookingRef: string;
  clubName: string;
  courseName: string;
  datetimeIso: string;
  timezone: string;
  playersCount: number;
}

export function DownloadCalendarButton({
  bookingRef,
  clubName,
  courseName,
  datetimeIso,
  timezone,
  playersCount,
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
      className="inline-flex items-center gap-1.5 rounded-lg border border-ds-stone bg-white px-4 py-2 text-sm font-medium text-ds-ink hover:bg-ds-cream/60"
    >
      Add to calendar
    </button>
  );
}
