"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";
import { BookingDrawer } from "@/components/teesheet/BookingDrawer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  toBookingsPageHref,
  toManageBookingsApiQuery,
  type BookingsPageQuery,
} from "./bookings-query";

export type ClubBookingRow = {
  id: string;
  bookingRef: string;
  guestName: string | null;
  guestEmail: string | null;
  playersCount: number;
  status: string | null;
  createdAt: string;
  teeSlot: {
    datetime: string;
    courseId: string;
    courseName: string;
  };
};

type SortKey =
  | "createdAt"
  | "teeTime"
  | "guestName"
  | "bookingRef"
  | "courseName"
  | "playersCount"
  | "status";

function formatTime(iso: string, timeZone: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

function formatDate(iso: string, timeZone: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(d);
}

function formatCreated(iso: string, timeZone: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

function defaultOrderFor(column: SortKey): "asc" | "desc" {
  if (
    column === "teeTime" ||
    column === "guestName" ||
    column === "courseName" ||
    column === "bookingRef"
  ) {
    return "asc";
  }
  return "desc";
}

function nextSortPatch(
  current: BookingsPageQuery,
  column: SortKey
): Partial<BookingsPageQuery> {
  if (current.sort === column) {
    return {
      order: current.order === "asc" ? "desc" : "asc",
      page: "1",
    };
  }
  return {
    sort: column,
    order: defaultOrderFor(column),
    page: "1",
  };
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "cancelled", label: "Cancelled" },
];

function SortHeader({
  clubId,
  query,
  column,
  label,
}: {
  clubId: string;
  query: BookingsPageQuery;
  column: SortKey;
  label: string;
}) {
  const active = query.sort === column;
  const href = toBookingsPageHref(clubId, query, nextSortPatch(query, column));
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 font-medium text-ink hover:text-fairway",
        active && "text-fairway"
      )}
    >
      {label}
      {active ? (
        query.order === "asc" ? (
          <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
        )
      ) : null}
    </Link>
  );
}

export function BookingsClient({
  clubId,
  bookings,
  total,
  page,
  limit,
  query,
  courses,
  timezone,
}: {
  clubId: string;
  bookings: ClubBookingRow[];
  total: number;
  limit: number;
  page: number;
  query: BookingsPageQuery;
  courses: { id: string; name: string }[];
  timezone: string;
}) {
  const router = useRouter();
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const openBooking = (id: string) => {
    setDrawerId(id);
    setDrawerOpen(true);
  };

  async function cancelBooking(id: string) {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("fail");
      toast.success("Booking cancelled");
      setCancelId(null);
      setDrawerOpen(false);
      setDrawerId(null);
      router.refresh();
    } catch {
      toast.error("Could not cancel");
    }
  }

  return (
    <>
      <SetTopBar title="Bookings" />
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
        <div className="space-y-1">
          <p className="max-w-2xl text-sm text-muted">
            Search and filter club bookings. With no dates, the range is today
            in the club&apos;s time zone. Default view is tee times for that
            day (same idea as the teesheet).
          </p>
        </div>

        <form
          key={toManageBookingsApiQuery(query) || "default"}
          className="flex flex-col gap-4 rounded-xl border border-stone bg-white p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            router.push(
              toBookingsPageHref(clubId, query, {
                q: String(fd.get("q") ?? "").trim(),
                from: String(fd.get("from") ?? "").trim(),
                to: String(fd.get("to") ?? "").trim(),
                range: String(fd.get("range") ?? "created"),
                status: String(fd.get("status") ?? "").trim(),
                courseId: String(fd.get("courseId") ?? "").trim(),
                limit: String(fd.get("limit") ?? "25"),
                page: "1",
              })
            );
          }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-[200px] flex-1 space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                Search
              </label>
              <Input
                name="q"
                placeholder="Guest, email, or reference"
                defaultValue={query.q}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                Range
              </label>
              <select
                name="range"
                defaultValue={query.range}
                className="flex h-9 w-full min-w-[140px] rounded-md border border-stone bg-warm-white px-3 py-1 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway"
              >
                <option value="created">Booked date</option>
                <option value="tee">Tee time</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                From
              </label>
              <Input
                name="from"
                type="date"
                defaultValue={query.from}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                To
              </label>
              <Input
                name="to"
                type="date"
                defaultValue={query.to}
              />
            </div>
            <div className="min-w-[160px] space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                Course
              </label>
              <select
                name="courseId"
                defaultValue={query.courseId}
                className="flex h-9 w-full rounded-md border border-stone bg-warm-white px-3 py-1 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway"
              >
                <option value="">All courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px] space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                Status
              </label>
              <select
                name="status"
                defaultValue={query.status}
                className="flex h-9 w-full rounded-md border border-stone bg-warm-white px-3 py-1 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                Per page
              </label>
              <select
                name="limit"
                defaultValue={query.limit}
                className="flex h-9 w-full min-w-[88px] rounded-md border border-stone bg-warm-white px-3 py-1 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <Button type="submit" className="lg:mb-0">
              Apply filters
            </Button>
          </div>
        </form>

        <div className="flex min-h-0 flex-col rounded-xl border border-stone bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone px-4 py-3">
            <h3 className="font-display text-lg text-ink">Bookings</h3>
            <p className="text-sm text-muted">
              {total === 0
                ? "No results"
                : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}
            </p>
          </div>
          {bookings.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No bookings match your filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-stone bg-cream/50 text-left text-[10px] font-bold uppercase tracking-widest text-muted">
                    <th className="px-4 py-2 font-medium">
                      <SortHeader
                        clubId={clubId}
                        query={query}
                        column="teeTime"
                        label="Tee time"
                      />
                    </th>
                    <th className="px-4 py-2 font-medium">
                      <SortHeader
                        clubId={clubId}
                        query={query}
                        column="guestName"
                        label="Guest"
                      />
                    </th>
                    <th className="hidden px-4 py-2 font-medium md:table-cell">
                      <SortHeader
                        clubId={clubId}
                        query={query}
                        column="courseName"
                        label="Course"
                      />
                    </th>
                    <th className="px-4 py-2 font-medium">
                      <SortHeader
                        clubId={clubId}
                        query={query}
                        column="playersCount"
                        label="Pl."
                      />
                    </th>
                    <th className="px-4 py-2 font-medium">
                      <SortHeader
                        clubId={clubId}
                        query={query}
                        column="status"
                        label="Status"
                      />
                    </th>
                    <th className="hidden px-4 py-2 font-medium lg:table-cell">
                      <SortHeader
                        clubId={clubId}
                        query={query}
                        column="createdAt"
                        label="Booked"
                      />
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      <div className="flex justify-end">
                        <SortHeader
                          clubId={clubId}
                          query={query}
                          column="bookingRef"
                          label="Ref"
                        />
                      </div>
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone">
                  {bookings.map((b) => (
                    <tr key={b.id} className="bg-white">
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => openBooking(b.id)}
                          className="text-left font-medium text-fairway hover:underline"
                        >
                          {formatTime(b.teeSlot.datetime, timezone)}
                          <span className="block text-xs font-normal text-muted md:inline md:ml-1">
                            {formatDate(b.teeSlot.datetime, timezone)}
                          </span>
                        </button>
                      </td>
                      <td className="max-w-[200px] px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => openBooking(b.id)}
                          className="w-full truncate text-left font-medium text-fairway hover:underline"
                        >
                          {b.guestName?.trim() || "Guest"}
                        </button>
                        {b.guestEmail ? (
                          <div className="truncate text-xs text-muted">
                            {b.guestEmail}
                          </div>
                        ) : null}
                      </td>
                      <td className="hidden max-w-[160px] truncate px-4 py-3 text-ink md:table-cell">
                        {b.teeSlot.courseName}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink">
                        {b.playersCount}
                      </td>
                      <td className="px-4 py-3 capitalize text-ink">
                        {(b.status ?? "—").replace(/_/g, " ")}
                      </td>
                      <td className="hidden px-4 py-3 text-muted lg:table-cell">
                        {formatCreated(b.createdAt, timezone)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openBooking(b.id)}
                          className="font-semibold text-fairway hover:underline"
                        >
                          {b.bookingRef}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="border-stone"
                            onClick={() => openBooking(b.id)}
                          >
                            View
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-stone text-red-700 hover:bg-red-50"
                            onClick={() => setCancelId(b.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > limit ? (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone px-4 py-3 text-sm text-muted">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={toBookingsPageHref(clubId, query, {
                        page: String(page - 1),
                      })}
                    >
                      Previous
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Previous
                  </Button>
                )}
                {page < totalPages ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={toBookingsPageHref(clubId, query, {
                        page: String(page + 1),
                      })}
                    >
                      Next
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <BookingDrawer
        bookingId={drawerId}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerId(null);
        }}
        onAfterChange={() => router.refresh()}
        timeZone={timezone}
      />

      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelId && cancelBooking(cancelId)}
            >
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
