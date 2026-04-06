"use client";

import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function PlatformClubsTopBar() {
  return (
    <SetPlatformTopBar
      title="Clubs"
      actions={
        <Button className="bg-fairway text-white hover:bg-fairway/90" size="sm" asChild>
          <Link href="/platform/clubs/new">+ New club</Link>
        </Button>
      }
    />
  );
}
