"use client";

import { useRouter } from "next/navigation";

export function ClubSwitcher({
  clubId,
  clubs,
}: {
  clubId: string;
  clubs: { id: string; name: string }[];
}) {
  const router = useRouter();
  if (clubs.length <= 1) return null;

  return (
    <label className="flex items-center gap-2 text-xs text-stone-500">
      <span className="hidden sm:inline">Club</span>
      <select
        className="bg-stone-800 border border-stone-700 rounded-lg text-stone-200 text-sm px-2 py-1 max-w-[200px]"
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
