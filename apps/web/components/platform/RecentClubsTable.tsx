"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type RecentClubRow = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  coursesCount: number;
  createdAt: string | null;
};

function clubStatusBadge(status: string | null) {
  const s = status ?? "active";
  if (s === "suspended") {
    return <StatusBadge status="no-show" label="Suspended" />;
  }
  return <StatusBadge status="confirmed" label="Active" />;
}

export function RecentClubsTable({ clubs }: { clubs: RecentClubRow[] }) {
  const router = useRouter();

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-stone bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone px-4 py-3">
        <h2 className="font-display text-lg text-ink">Recent clubs</h2>
        <Link
          href="/platform/clubs"
          className="text-sm font-semibold text-fairway hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-stone bg-cream/50 text-left text-[10px] font-bold uppercase tracking-widest text-muted">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="hidden px-4 py-2 font-medium lg:table-cell">
                Slug
              </th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Courses</th>
              <th className="hidden px-4 py-2 text-right font-medium lg:table-cell">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {clubs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted"
                >
                  No clubs yet.
                </td>
              </tr>
            ) : (
              clubs.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-b border-stone transition-colors hover:bg-cream"
                  onClick={() => router.push(`/platform/clubs/${c.id}`)}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/platform/clubs/${c.id}`}
                      className="font-medium text-ink hover:text-fairway"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-muted lg:table-cell">
                    {c.slug}
                  </td>
                  <td className="px-4 py-3">{clubStatusBadge(c.status)}</td>
                  <td className="px-4 py-3 text-right text-muted">
                    {c.coursesCount}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-sm text-muted lg:table-cell">
                    {c.createdAt
                      ? formatDistanceToNow(new Date(c.createdAt), {
                          addSuffix: true,
                        })
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
