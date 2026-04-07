"use client";

import { useState } from "react";
import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";

export type PlatformTagRow = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
  groupName: string | null;
  active: boolean;
  createdAt: string | null;
};

export function PlatformTagsClient({ initialTags }: { initialTags: PlatformTagRow[] }) {
  const [tags, setTags] = useState(initialTags);
  const [error, setError] = useState("");
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [groupName, setGroupName] = useState("");
  const [sortOrder, setSortOrder] = useState("100");
  const [saving, setSaving] = useState(false);

  async function toggleActive(t: PlatformTagRow) {
    setError("");
    const res = await fetch(`/api/platform/tags/${encodeURIComponent(t.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Update failed");
      return;
    }
    const updated = (await res.json()) as PlatformTagRow;
    setTags((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/platform/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          label: label.trim(),
          sortOrder: Number.parseInt(sortOrder, 10) || 0,
          groupName: groupName.trim() || null,
          active: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Create failed");
        return;
      }
      const row = data as PlatformTagRow;
      setTags((prev) => [...prev, row].sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug)));
      setSlug("");
      setLabel("");
      setGroupName("");
      setSortOrder("100");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SetPlatformTopBar title="Tags" backLink={{ href: "/platform", label: "← Dashboard" }} />
      <div className="p-6">
        <p className="mb-5 text-sm text-muted">
          Platform-managed tags clubs can assign to their public listing. Slugs are stable for URLs (
          <code className="text-xs">?tag=slug</code>).
        </p>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={handleCreate}
          className="mb-8 flex max-w-3xl flex-col gap-3 rounded-xl border border-stone bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="flex min-w-[120px] flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="rounded-lg border border-stone px-3 py-2"
              placeholder="e.g. links"
              required
            />
          </label>
          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="rounded-lg border border-stone px-3 py-2"
              placeholder="Display name"
              required
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Sort</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="rounded-lg border border-stone px-3 py-2"
            />
          </label>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Group</span>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="rounded-lg border border-stone px-3 py-2"
              placeholder="Course character"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Add tag
          </button>
        </form>

        <div className="overflow-x-auto rounded-xl border border-stone bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-stone bg-stone/40 text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Sort</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.id} className="border-b border-stone/80">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(t)}
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        t.active ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-600"
                      }`}
                    >
                      {t.active ? "On" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{t.slug}</td>
                  <td className="px-4 py-2">{t.label}</td>
                  <td className="px-4 py-2 text-muted">{t.groupName ?? "—"}</td>
                  <td className="px-4 py-2">{t.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
