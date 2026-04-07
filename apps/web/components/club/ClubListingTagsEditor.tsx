"use client";

import { useCallback, useEffect, useState } from "react";

type CatalogTag = {
  slug: string;
  label: string;
  groupName: string | null;
  sortOrder: number;
};

type AssignedTag = { slug: string; label: string };

export function ClubListingTagsEditor({ clubId }: { clubId: string }) {
  const [catalog, setCatalog] = useState<CatalogTag[]>([]);
  const [assignedSlugs, setAssignedSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/clubs/${clubId}/tags`, { cache: "no-store" });
      if (!res.ok) {
        setError("Could not load tags");
        return;
      }
      const data = (await res.json()) as {
        catalog: CatalogTag[];
        assigned: AssignedTag[];
      };
      setCatalog(data.catalog ?? []);
      setAssignedSlugs(new Set((data.assigned ?? []).map((a) => a.slug)));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(slug: string) {
    setAssignedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
    setSuccess("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/clubs/${clubId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagSlugs: [...assignedSlugs] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Save failed");
        return;
      }
      setSuccess("Listing tags updated.");
    } finally {
      setSaving(false);
    }
  }

  const byGroup = new Map<string, CatalogTag[]>();
  for (const t of catalog) {
    const g = t.groupName ?? "Other";
    const list = byGroup.get(g) ?? [];
    list.push(t);
    byGroup.set(g, list);
  }
  const groupOrder = [...byGroup.keys()].sort();

  return (
    <div className="rounded-xl border border-stone bg-white shadow-sm">
      <div className="border-b border-stone px-4 py-3">
        <h3 className="font-display text-lg text-ink">Listing tags</h3>
        <p className="mt-1 text-xs text-muted">
          Choose tags that describe your club on public search. Only tags enabled by the platform are
          available.
        </p>
      </div>
      <div className="p-4">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <>
            {error ? (
              <p className="mb-3 text-sm text-red-700">{error}</p>
            ) : null}
            {success ? (
              <p className="mb-3 text-sm text-green-800">{success}</p>
            ) : null}
            <div className="max-h-[360px] space-y-4 overflow-y-auto pr-1">
              {groupOrder.map((g) => (
                <div key={g}>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                    {g}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(byGroup.get(g) ?? []).map((t) => {
                      const on = assignedSlugs.has(t.slug);
                      return (
                        <button
                          key={t.slug}
                          type="button"
                          onClick={() => toggle(t.slug)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            on
                              ? "border-fairway bg-fairway text-white"
                              : "border-stone bg-white text-ink hover:border-fairway/50"
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="mt-4 rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save tags"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
