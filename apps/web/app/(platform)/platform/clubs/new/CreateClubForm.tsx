"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateClubForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
    const body = {
      name: String(fd.get("name") ?? "").trim(),
      slug,
      timezone: String(fd.get("timezone") ?? "America/New_York"),
      description: String(fd.get("description") ?? "").trim() || undefined,
    };

    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError("Slug: lowercase letters, numbers, and hyphens only.");
      setPending(false);
      return;
    }

    const res = await fetch("/api/platform/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : "Could not create club."
      );
      return;
    }
    router.push(`/platform/clubs/${data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={(ev) => void onSubmit(ev)}
      className="max-w-md space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6"
    >
      <div>
        <label htmlFor="name" className="block text-xs text-slate-400 mb-1">
          Club name
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="slug" className="block text-xs text-slate-400 mb-1">
          URL slug
        </label>
        <input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9-]+"
          title="Lowercase letters, numbers, hyphens only"
          placeholder="e.g. pinebrook"
          className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm font-mono"
        />
      </div>
      <div>
        <label htmlFor="timezone" className="block text-xs text-slate-400 mb-1">
          Timezone
        </label>
        <input
          id="timezone"
          name="timezone"
          defaultValue="America/New_York"
          required
          className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="description"
          className="block text-xs text-slate-400 mb-1"
        >
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm resize-y min-h-[80px]"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm"
      >
        {pending ? "Creating…" : "Create club"}
      </button>
    </form>
  );
}
