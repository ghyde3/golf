"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export interface CourseHolesEditorProps {
  clubId: string;
  course: { id: string; name: string; holes: number };
}

type ApiHole = {
  id: string;
  courseId: string;
  holeNumber: number;
  par: number;
  handicapIndex: number | null;
  yardage: number | null;
};

type DraftRow = {
  holeNumber: number;
  par: number;
  handicapText: string;
  yardageText: string;
};

function authHeaders(token: string | undefined): HeadersInit {
  const h: Record<string, string> = {};
  if (token?.trim()) {
    h.Authorization = `Bearer ${token.trim()}`;
  }
  return h;
}

function buildDraft(saved: ApiHole[], holeCount: number): DraftRow[] {
  const byHole = new Map(saved.map((h) => [h.holeNumber, h]));
  return Array.from({ length: holeCount }, (_, i) => {
    const holeNumber = i + 1;
    const h = byHole.get(holeNumber);
    return {
      holeNumber,
      par: h?.par ?? 4,
      handicapText:
        h?.handicapIndex != null && h.handicapIndex >= 1 && h.handicapIndex <= 18
          ? String(h.handicapIndex)
          : "",
      yardageText:
        h?.yardage != null && h.yardage >= 1 && h.yardage <= 1000
          ? String(h.yardage)
          : "",
    };
  });
}

function draftToPayload(rows: DraftRow[]) {
  return rows.map((row) => {
    const base: {
      holeNumber: number;
      par: number;
      handicapIndex?: number | null;
      yardage?: number | null;
    } = {
      holeNumber: row.holeNumber,
      par: row.par,
    };
    const hci = parseInt(row.handicapText.trim(), 10);
    if (!Number.isNaN(hci) && hci >= 1 && hci <= 18) {
      base.handicapIndex = hci;
    } else {
      base.handicapIndex = null;
    }
    const yd = parseInt(row.yardageText.trim(), 10);
    if (!Number.isNaN(yd) && yd >= 1 && yd <= 1000) {
      base.yardage = yd;
    } else {
      base.yardage = null;
    }
    return base;
  });
}

export function CourseHolesEditor({ clubId, course }: CourseHolesEditorProps) {
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.accessToken;

  const [holes, setHoles] = useState<ApiHole[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const holeCount = course.holes;

  const fetchHoles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/courses/${course.id}/holes`,
        {
          headers: authHeaders(token),
          cache: "no-store",
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError(data.error ?? "Could not load holes");
        setHoles(null);
        return;
      }
      const data = (await res.json()) as ApiHole[];
      setHoles(data);
    } catch {
      setLoadError("Could not load holes");
      setHoles(null);
    } finally {
      setLoading(false);
    }
  }, [clubId, course.id, token]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    void fetchHoles();
  }, [fetchHoles, sessionStatus]);

  const totalParSaved = useMemo(() => {
    if (!holes?.length) return 0;
    return holes.reduce((sum, h) => sum + h.par, 0);
  }, [holes]);

  const openEditor = () => {
    setSaveError(null);
    setDraft(buildDraft(holes ?? [], holeCount));
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setSaveError(null);
  };

  const totalParDraft = useMemo(
    () => draft.reduce((sum, r) => sum + r.par, 0),
    [draft]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const body = draftToPayload(draft);
      const res = await fetch(
        `/api/clubs/${clubId}/courses/${course.id}/holes`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token),
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setSaveError(data.error ?? "Failed to save holes");
        return;
      }
      const next = (await res.json()) as ApiHole[];
      setHoles(next);
      toast.success("Holes saved");
      setEditorOpen(false);
    } catch {
      setSaveError("Failed to save holes");
    } finally {
      setSaving(false);
    }
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="rounded-lg border border-stone bg-cream/30 px-3 py-2 text-xs text-muted">
        Loading hole configuration…
      </div>
    );
  }

  if (loadError && holes === null) {
    return (
      <div className="rounded-lg border border-stone bg-white px-3 py-2 text-sm text-red-600">
        {loadError}
      </div>
    );
  }

  const configured = (holes?.length ?? 0) > 0;
  const showSetup = !configured && !editorOpen;

  return (
    <div className="mt-2 space-y-2">
      {showSetup && (
        <button
          type="button"
          onClick={openEditor}
          className="rounded-lg border border-stone bg-white px-3 py-2 text-sm font-semibold text-fairway shadow-sm hover:bg-cream/50"
        >
          Set up holes
        </button>
      )}

      {configured && !editorOpen && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            Par {totalParSaved} · {holes?.length ?? 0} holes configured
          </p>
          <button
            type="button"
            onClick={openEditor}
            className="text-xs font-semibold text-fairway hover:underline"
          >
            Edit holes
          </button>
        </div>
      )}

      {editorOpen && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-stone bg-white p-4 shadow-sm"
        >
          <h4 className="mb-3 font-display text-sm text-ink">
            Hole configuration
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone bg-cream/50 text-left text-[10px] font-bold uppercase tracking-widest text-muted">
                  <th className="px-2 py-2">Hole</th>
                  <th className="px-2 py-2">Par</th>
                  <th className="px-2 py-2">HCP</th>
                  <th className="px-2 py-2">Yds</th>
                </tr>
              </thead>
              <tbody>
                {draft.map((row, idx) => (
                  <tr
                    key={row.holeNumber}
                    className={idx % 2 === 0 ? "bg-white" : "bg-cream/20"}
                  >
                    <td className="px-2 py-2 font-medium text-ink">
                      {row.holeNumber}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {([3, 4, 5] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() =>
                              setDraft((d) =>
                                d.map((x) =>
                                  x.holeNumber === row.holeNumber
                                    ? { ...x, par: p }
                                    : x
                                )
                              )
                            }
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                              row.par === p
                                ? "bg-fairway text-white"
                                : "border border-stone bg-white text-ink hover:border-fairway/50"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={1}
                        max={18}
                        inputMode="numeric"
                        placeholder="HCP"
                        value={row.handicapText}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft((d) =>
                            d.map((x) =>
                              x.holeNumber === row.holeNumber
                                ? { ...x, handicapText: v }
                                : x
                            )
                          );
                        }}
                        className="w-full min-w-[3.5rem] rounded-lg border border-stone px-2 py-1.5 text-sm text-ink placeholder-muted focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        inputMode="numeric"
                        placeholder="Yds"
                        value={row.yardageText}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft((d) =>
                            d.map((x) =>
                              x.holeNumber === row.holeNumber
                                ? { ...x, yardageText: v }
                                : x
                            )
                          );
                        }}
                        className="w-full min-w-[3.5rem] rounded-lg border border-stone px-2 py-1.5 text-sm text-ink placeholder-muted focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm font-medium text-ink">
            Total par: {totalParDraft}
          </p>
          {saveError && (
            <p className="mt-2 text-sm text-red-600">{saveError}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-fairway/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-lg border border-stone px-4 py-2 text-sm font-semibold text-ink hover:bg-cream/50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
