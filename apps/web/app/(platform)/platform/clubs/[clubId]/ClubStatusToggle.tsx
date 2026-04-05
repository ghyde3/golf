"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClubStatusToggle({
  clubId,
  status,
}: {
  clubId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const suspended = status === "suspended";

  async function toggle() {
    setPending(true);
    const next = suspended ? "active" : "suspended";
    const res = await fetch(`/api/platform/clubs/${clubId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setPending(false);
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <span
        className={
          suspended
            ? "inline-flex rounded-full bg-amber-500/15 text-amber-400 px-3 py-1 text-xs font-medium"
            : "inline-flex rounded-full bg-emerald-500/15 text-emerald-400 px-3 py-1 text-xs font-medium"
        }
      >
        {suspended ? "Suspended" : "Active"}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => void toggle()}
        className="text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg px-3 py-1.5 disabled:opacity-50"
      >
        {pending ? "Updating…" : suspended ? "Activate club" : "Suspend club"}
      </button>
    </div>
  );
}
