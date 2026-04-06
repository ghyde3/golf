"use client";

import { PlatformClubTableRow } from "@/components/platform/PlatformClubTableRow";
import type { PlatformClubRow } from "@/components/platform/platform-club-types";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export type { PlatformClubRow };

export function PlatformClubsTable({
  clubs,
  page,
  total,
  limit,
}: {
  clubs: PlatformClubRow[];
  page: number;
  total: number;
  limit: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showPagination = total > limit;

  return (
    <div className="rounded-xl border border-stone bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
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
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clubs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted"
                >
                  No clubs loaded (check API or sign in).
                </td>
              </tr>
            ) : (
              clubs.map((c) => <PlatformClubTableRow key={c.id} club={c} />)
            )}
          </tbody>
        </table>
      </div>
      {showPagination ? (
        <div className="flex items-center justify-between gap-4 border-t border-stone px-4 py-3 text-sm text-muted">
          <span>
            Page {page} of {totalPages} ({total} clubs)
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/platform/clubs?page=${page - 1}`}>
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
                <Link href={`/platform/clubs?page=${page + 1}`}>Next</Link>
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
  );
}
