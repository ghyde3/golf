"use client";

import { useCallback, useState } from "react";
import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type PlatformAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: "all" | "clubs" | "club_specific";
  clubId: string | null;
  status: "draft" | "active" | "archived";
  publishAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type StatusTab = "all" | "draft" | "active" | "archived";

function previewBody(body: string, max = 120) {
  const t = body.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadgeClass(status: PlatformAnnouncementRow["status"]) {
  switch (status) {
    case "draft":
      return "bg-stone-200 text-stone-700";
    case "active":
      return "bg-green-100 text-green-800";
    case "archived":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-stone-200 text-stone-700";
  }
}

function audienceBadgeClass(audience: PlatformAnnouncementRow["audience"]) {
  switch (audience) {
    case "all":
      return "bg-blue-100 text-blue-800";
    case "clubs":
      return "bg-purple-100 text-purple-800";
    case "club_specific":
      return "bg-orange-100 text-orange-900";
    default:
      return "bg-stone-200 text-stone-700";
  }
}

function audienceLabel(audience: PlatformAnnouncementRow["audience"]) {
  switch (audience) {
    case "all":
      return "All golfers";
    case "clubs":
      return "All clubs";
    case "club_specific":
      return "Specific club";
    default:
      return audience;
  }
}

export function AnnouncementsClient({
  initialAnnouncements,
  initialPage,
  initialLimit,
  initialTotal,
}: {
  initialAnnouncements: PlatformAnnouncementRow[];
  initialPage: number;
  initialLimit: number;
  initialTotal: number;
}) {
  const [items, setItems] = useState(initialAnnouncements);
  const [page] = useState(initialPage);
  const [limit] = useState(initialLimit);
  const [total, setTotal] = useState(initialTotal);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformAnnouncementRow | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<PlatformAnnouncementRow["audience"]>("all");
  const [clubId, setClubId] = useState("");
  const [publishAtLocal, setPublishAtLocal] = useState("");
  const [status, setStatus] = useState<PlatformAnnouncementRow["status"]>("draft");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PlatformAnnouncementRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(
    async (tab: StatusTab) => {
      setLoading(true);
      setError("");
      try {
        const q = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (tab !== "all") q.set("status", tab);
        const res = await fetch(`/api/platform/announcements?${q}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { error?: string }).error ?? "Failed to load announcements");
          return;
        }
        const parsed = data as {
          announcements: PlatformAnnouncementRow[];
          total: number;
        };
        setItems(parsed.announcements ?? []);
        setTotal(parsed.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [page, limit]
  );

  function selectTab(tab: StatusTab) {
    setStatusTab(tab);
    void fetchList(tab);
  }

  function openCreate() {
    setEditing(null);
    setTitle("");
    setBody("");
    setAudience("all");
    setClubId("");
    setPublishAtLocal("");
    setStatus("draft");
    setFormOpen(true);
  }

  function openEdit(row: PlatformAnnouncementRow) {
    setEditing(row);
    setTitle(row.title);
    setBody(row.body);
    setAudience(row.audience);
    setClubId(row.clubId ?? "");
    setPublishAtLocal(toDatetimeLocalValue(row.publishAt));
    setStatus(row.status);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const publishAtIso =
        publishAtLocal.trim().length > 0
          ? new Date(publishAtLocal).toISOString()
          : null;
      const payload: Record<string, unknown> = {
        title: title.trim(),
        body: body.trim(),
        audience,
        status,
        publishAt: publishAtIso,
      };
      if (audience === "club_specific" && clubId.trim()) {
        payload.clubId = clubId.trim();
      } else if (audience === "club_specific") {
        payload.clubId = null;
      } else {
        payload.clubId = null;
      }

      const url = editing
        ? `/api/platform/announcements/${encodeURIComponent(editing.id)}`
        : "/api/platform/announcements";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Save failed");
        return;
      }
      setFormOpen(false);
      await fetchList(statusTab);
    } finally {
      setSaving(false);
    }
  }

  async function publish(row: PlatformAnnouncementRow) {
    setError("");
    const res = await fetch(`/api/platform/announcements/${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Publish failed");
      return;
    }
    await fetchList(statusTab);
  }

  async function archive(row: PlatformAnnouncementRow) {
    setError("");
    const res = await fetch(`/api/platform/announcements/${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Archive failed");
      return;
    }
    await fetchList(statusTab);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/platform/announcements/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );
      if (res.status === 204) {
        setDeleteTarget(null);
        await fetchList(statusTab);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const tabs: { id: StatusTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "draft", label: "Draft" },
    { id: "active", label: "Active" },
    { id: "archived", label: "Archived" },
  ];

  return (
    <>
      <SetPlatformTopBar
        title="Announcements"
        backLink={{ href: "/platform", label: "← Dashboard" }}
      />
      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{loading ? "Loading…" : `${total} total`}</p>
          <Button type="button" onClick={openCreate} className="shrink-0">
            New Announcement
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                statusTab === t.id
                  ? "bg-fairway text-white"
                  : "bg-cream text-ink ring-1 ring-stone hover:bg-stone/40"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {items.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-stone bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-semibold text-ink">{row.title}</h2>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      statusBadgeClass(row.status)
                    )}
                  >
                    {row.status}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      audienceBadgeClass(row.audience)
                    )}
                  >
                    {audienceLabel(row.audience)}
                  </span>
                </div>
              </div>
              <p className="mb-3 text-sm text-muted">{previewBody(row.body)}</p>
              {row.publishAt ? (
                <p className="mb-3 text-xs text-muted">
                  Scheduled for:{" "}
                  {new Date(row.publishAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {row.status === "draft" ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => publish(row)}>
                    Publish
                  </Button>
                ) : null}
                {row.status === "active" ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => archive(row)}>
                    Archive
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                {row.status === "draft" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteTarget(row)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {!loading && items.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted">No announcements yet.</p>
        ) : null}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Title</span>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={255}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Body</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={6}
                className="min-h-[140px] w-full rounded-md border border-stone bg-warm-white px-3 py-2 text-sm text-ink shadow-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway focus-visible:ring-offset-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Audience</span>
              <select
                value={audience}
                onChange={(e) =>
                  setAudience(e.target.value as PlatformAnnouncementRow["audience"])
                }
                className="h-9 w-full rounded-md border border-stone bg-warm-white px-3 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway focus-visible:ring-offset-2"
              >
                <option value="all">All golfers</option>
                <option value="clubs">All clubs</option>
                <option value="club_specific">Specific club</option>
              </select>
            </label>
            {audience === "club_specific" ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Club ID</span>
                <Input
                  value={clubId}
                  onChange={(e) => setClubId(e.target.value)}
                  placeholder="UUID"
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Publish at (optional)</span>
              <Input
                type="datetime-local"
                value={publishAtLocal}
                onChange={(e) => setPublishAtLocal(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Status</span>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as PlatformAnnouncementRow["status"])
                }
                className="h-9 w-full rounded-md border border-stone bg-warm-white px-3 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway focus-visible:ring-offset-2"
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the draft “{deleteTarget?.title}”. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-600/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
