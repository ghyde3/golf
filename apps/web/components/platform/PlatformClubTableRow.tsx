"use client";

import { PlatformClubStatusButton } from "@/components/platform/PlatformClubStatusButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PlatformClubRow } from "@/components/platform/platform-club-types";

function clubStatusBadge(status: string | null) {
  const s = status ?? "active";
  if (s === "suspended") {
    return <StatusBadge status="no-show" label="Suspended" />;
  }
  return <StatusBadge status="confirmed" label="Active" />;
}

export function PlatformClubTableRow({ club }: { club: PlatformClubRow }) {
  const router = useRouter();
  const [status, setStatus] = useState(club.status ?? "active");

  useEffect(() => {
    setStatus(club.status ?? "active");
  }, [club.id, club.status]);

  return (
    <tr
      className="group cursor-pointer border-b border-stone transition-colors hover:bg-cream"
      onClick={() => router.push(`/platform/clubs/${club.id}`)}
    >
      <td className="px-4 py-3">
        <span className="font-medium text-ink">{club.name}</span>
      </td>
      <td className="hidden px-4 py-3 font-mono text-muted lg:table-cell">
        {club.slug}
      </td>
      <td className="px-4 py-3">{clubStatusBadge(status)}</td>
      <td className="px-4 py-3 text-right text-muted">{club.coursesCount}</td>
      <td className="hidden px-4 py-3 text-right text-sm text-muted lg:table-cell">
        {club.createdAt
          ? formatDistanceToNow(new Date(club.createdAt), {
              addSuffix: true,
            })
          : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <div
          className="flex justify-end gap-2 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/platform/clubs/${club.id}`}>View</Link>
          </Button>
          <PlatformClubStatusButton
            clubId={club.id}
            clubName={club.name}
            status={status}
            onStatusChange={setStatus}
            size="sm"
          />
        </div>
      </td>
    </tr>
  );
}
