"use client";

import { usePlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function PlatformTopBar() {
  const { title, actions, backLink } = usePlatformTopBar();

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b border-stone bg-warm-white px-4 lg:px-6"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {backLink ? (
          <Link
            href={backLink.href}
            className="shrink-0 text-sm font-medium text-fairway hover:underline"
          >
            {backLink.label}
          </Link>
        ) : null}
        <h1 className="font-display min-w-0 truncate text-lg text-ink">
          {title}
        </h1>
      </div>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
        {actions}
      </div>
    </header>
  );
}
