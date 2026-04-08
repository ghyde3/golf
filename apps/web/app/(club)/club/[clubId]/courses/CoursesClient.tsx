"use client";

import { useState } from "react";
import { CourseHolesEditor } from "@/components/club/CourseHolesEditor";
import { SetTopBar } from "@/components/club/ClubTopBarContext";

export type CourseRow = { id: string; name: string; holes: number };

type EditState = { id: string; name: string; holes: 9 | 18 } | null;

function HolesBadge({ holes }: { holes: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-fairway/10 px-2 py-0.5 text-xs font-semibold text-fairway">
      {holes} holes
    </span>
  );
}

export function CoursesClient({
  clubId,
  courses: initial,
}: {
  clubId: string;
  courses: CourseRow[];
}) {
  const [courses, setCourses] = useState<CourseRow[]>(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addHoles, setAddHoles] = useState<9 | 18>(18);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [editState, setEditState] = useState<EditState>(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAddSaving(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), holes: addHoles }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddError((data as { error?: string }).error ?? "Failed to add course");
        return;
      }
      const newCourse = (await res.json()) as CourseRow;
      setCourses((prev) =>
        [...prev, newCourse].sort((a, b) => a.name.localeCompare(b.name))
      );
      setAddName("");
      setAddHoles(18);
      setShowAdd(false);
    } finally {
      setAddSaving(false);
    }
  }

  function openEdit(c: CourseRow) {
    setEditState({ id: c.id, name: c.name, holes: c.holes as 9 | 18 });
    setEditError("");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editState) return;
    setEditError("");
    setEditSaving(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/courses/${editState.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editState.name.trim(), holes: editState.holes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEditError((data as { error?: string }).error ?? "Failed to update course");
        return;
      }
      const updated = (await res.json()) as CourseRow;
      setCourses((prev) =>
        prev
          .map((c) => (c.id === updated.id ? updated : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditState(null);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <>
      <SetTopBar title="Courses" />
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="max-w-xl text-sm text-muted">
              Manage the courses available for tee time bookings.
            </p>
          </div>
          <button
            onClick={() => {
              setShowAdd(true);
              setAddError("");
            }}
            className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-fairway/90 focus:outline-none focus:ring-2 focus:ring-fairway/50"
          >
            Add course
          </button>
        </div>

        {/* Add course form */}
        {showAdd && (
          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-display text-base text-ink">New course</h3>
            <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Course name
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                  placeholder="e.g. Championship Course"
                  className="w-full rounded-lg border border-stone px-3 py-2 text-sm text-ink placeholder-muted focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Holes
                </label>
                <div className="flex gap-2">
                  {([9, 18] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setAddHoles(h)}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                        addHoles === h
                          ? "border-fairway bg-fairway text-white"
                          : "border-stone bg-white text-ink hover:border-fairway/50"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addSaving || !addName.trim()}
                  className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-fairway/90 disabled:opacity-50"
                >
                  {addSaving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setAddError("");
                    setAddName("");
                    setAddHoles(18);
                  }}
                  className="rounded-lg border border-stone px-4 py-2 text-sm font-semibold text-ink hover:bg-cream/50"
                >
                  Cancel
                </button>
              </div>
            </form>
            {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}
          </div>
        )}

        {/* Edit course modal */}
        {editState && (
          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-display text-base text-ink">Edit course</h3>
            <form onSubmit={handleEdit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Course name
                </label>
                <input
                  type="text"
                  value={editState.name}
                  onChange={(e) =>
                    setEditState((s) => s && { ...s, name: e.target.value })
                  }
                  required
                  className="w-full rounded-lg border border-stone px-3 py-2 text-sm text-ink placeholder-muted focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Holes
                </label>
                <div className="flex gap-2">
                  {([9, 18] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setEditState((s) => s && { ...s, holes: h })}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                        editState.holes === h
                          ? "border-fairway bg-fairway text-white"
                          : "border-stone bg-white text-ink hover:border-fairway/50"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={editSaving || !editState.name.trim()}
                  className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-fairway/90 disabled:opacity-50"
                >
                  {editSaving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditState(null);
                    setEditError("");
                  }}
                  className="rounded-lg border border-stone px-4 py-2 text-sm font-semibold text-ink hover:bg-cream/50"
                >
                  Cancel
                </button>
              </div>
            </form>
            {editError && <p className="mt-2 text-sm text-red-600">{editError}</p>}
          </div>
        )}

        {/* Courses table */}
        <div className="flex min-h-0 flex-col rounded-xl border border-stone bg-white shadow-sm">
          <div className="border-b border-stone px-4 py-3">
            <h3 className="font-display text-lg text-ink">All courses</h3>
          </div>
          {courses.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No courses yet. Add your first course above.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_80px_80px] border-b border-stone bg-cream/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                <span>Name</span>
                <span>Holes</span>
                <span />
              </div>
              <div className="divide-y divide-stone">
                {courses.map((c) => (
                  <div key={c.id}>
                    <div className="grid grid-cols-[minmax(0,1fr)_80px_80px] items-center px-4 py-3">
                      <span className="truncate text-sm font-medium text-ink">
                        {c.name}
                      </span>
                      <HolesBadge holes={c.holes} />
                      <div className="text-right">
                        <button
                          onClick={() => openEdit(c)}
                          className="text-xs font-semibold text-fairway hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                    <div className="px-4 pb-3">
                      <CourseHolesEditor clubId={clubId} course={c} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
