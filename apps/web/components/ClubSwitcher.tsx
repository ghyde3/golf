"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClubSwitcher({
  clubId,
  clubs,
  variant = "default",
  roleLabel,
}: {
  clubId: string;
  clubs: { id: string; name: string; slug?: string }[];
  variant?: "default" | "sidebar";
  /** e.g. "Admin" / "Staff" for current club */
  roleLabel?: string | null;
}) {
  const router = useRouter();
  if (clubs.length <= 1) {
    if (variant === "sidebar") {
      const current = clubs[0];
      const initials = (current?.name ?? "C")
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      return (
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg border border-white/10 px-2 py-2",
            "bg-white/[0.04]"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fairway text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1 sidebar-text">
            <p className="truncate text-[13px] font-semibold text-white">
              {current?.name ?? "Club"}
            </p>
            {roleLabel ? (
              <p className="text-[11px] text-white/40">{roleLabel}</p>
            ) : null}
          </div>
        </div>
      );
    }
    return null;
  }

  const current = clubs.find((c) => c.id === clubId) ?? clubs[0];
  const initials = (current?.name ?? "C")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (variant === "sidebar") {
    return (
      <label className="relative flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/10 px-2 py-2 transition hover:bg-white/[0.06]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fairway text-xs font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1 sidebar-text">
          <p className="truncate text-[13px] font-semibold text-white">
            {current.name}
          </p>
          {roleLabel ? (
            <p className="text-[11px] text-white/40">{roleLabel}</p>
          ) : null}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Switch club"
          value={clubId}
          onChange={(e) => {
            router.push(`/club/${e.target.value}/dashboard`);
          }}
        >
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="flex items-center gap-2 text-xs text-stone-500">
      <span className="hidden sm:inline">Club</span>
      <select
        className="max-w-[200px] rounded-lg border border-stone-700 bg-stone-800 px-2 py-1 text-sm text-stone-200"
        value={clubId}
        onChange={(e) => {
          router.push(`/club/${e.target.value}/dashboard`);
        }}
      >
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
