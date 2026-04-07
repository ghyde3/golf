"use client";

import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useCallback, useState } from "react";

export type AuditLogEntryRow = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: unknown;
  createdAt: string;
};

function formatTimestamp(iso: string) {
  try {
    return format(parseISO(iso), "MMM d, yyyy HH:mm:ss");
  } catch {
    return iso;
  }
}

function entityLabel(entityType: string | null, entityId: string | null) {
  if (!entityType && !entityId) return "—";
  if (entityType && entityId) return `${entityType}: ${entityId}`;
  return entityType ?? entityId ?? "—";
}

export function AuditLogClient({
  initialEntries,
  initialPage,
  initialLimit,
  initialTotal,
}: {
  initialEntries: AuditLogEntryRow[];
  initialPage: number;
  initialLimit: number;
  initialTotal: number;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [page, setPage] = useState(initialPage);
  const [limit] = useState(initialLimit);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [actionFilter, setActionFilter] = useState("");
  const [actorEmailFilter, setActorEmailFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLog = useCallback(
    async (pageToUse: number) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(pageToUse),
          limit: String(limit),
        });
        if (actionFilter.trim()) params.set("action", actionFilter.trim());
        if (actorEmailFilter.trim())
          params.set("actorEmail", actorEmailFilter.trim());
        if (fromDate.trim()) params.set("from", fromDate.trim());
        if (toDate.trim()) params.set("to", toDate.trim());

        const res = await fetch(`/api/platform/audit-log?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { error?: string }).error ?? "Failed to load audit log");
          return;
        }
        const body = data as {
          entries: AuditLogEntryRow[];
          page: number;
          total: number;
        };
        setEntries(body.entries ?? []);
        setTotal(body.total ?? 0);
        setPage(body.page ?? pageToUse);
      } finally {
        setLoading(false);
      }
    },
    [limit, actionFilter, actorEmailFilter, fromDate, toDate]
  );

  const onApplyFilters = () => {
    setExpandedId(null);
    void fetchLog(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <>
      <SetPlatformTopBar
        title="Audit Log"
        backLink={{ href: "/platform", label: "← Dashboard" }}
      />
      <div className="p-6">
        <p className="mb-5 text-sm text-muted">
          Immutable record of all platform admin actions.
        </p>

        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-stone bg-cream/30 p-4">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
              Action
            </label>
            <Input
              placeholder="e.g. settings.update"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-9 font-mono text-sm"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
              Actor email
            </label>
            <Input
              placeholder="Search by email"
              value={actorEmailFilter}
              onChange={(e) => setActorEmailFilter(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="min-w-[130px]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
              From
            </label>
            <Input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="min-w-[130px]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
              To
            </label>
            <Input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9"
            onClick={onApplyFilters}
            disabled={loading}
          >
            Apply filters
          </Button>
        </div>

        {error ? (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="rounded-xl border border-stone bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-stone bg-cream/50 text-left text-[10px] font-bold uppercase tracking-widest text-muted">
                  <th className="px-4 py-2 font-medium">Timestamp</th>
                  <th className="px-4 py-2 font-medium">Actor</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Entity</th>
                  <th className="w-[100px] px-4 py-2 text-right font-medium">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      Loading…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      No audit entries match your filters.
                    </td>
                  </tr>
                ) : (
                  entries.map((row) => {
                    const open = expandedId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr className="border-b border-stone/80 last:border-0">
                          <td className="whitespace-nowrap px-4 py-4 text-ink">
                            {formatTimestamp(row.createdAt)}
                          </td>
                          <td className="px-4 py-4">
                            {row.actorId == null ? (
                              <span className="text-muted">System</span>
                            ) : (
                              <div>
                                <div className="font-medium text-ink">
                                  {row.actorName ?? "—"}
                                </div>
                                <div className="text-xs text-muted">
                                  {row.actorEmail ?? ""}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <code className="rounded bg-stone/80 px-1.5 py-0.5 text-xs font-mono text-ink">
                              {row.action}
                            </code>
                          </td>
                          <td className="px-4 py-4 font-mono text-xs text-ink">
                            {entityLabel(row.entityType, row.entityId)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedId(open ? null : row.id)
                              }
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ds-fairway hover:bg-cream/80"
                            >
                              {open ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {open ? "Hide" : "Expand"}
                            </button>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="bg-cream/40">
                            <td colSpan={5} className="px-4 pb-4 pt-0">
                              <pre className="max-h-64 overflow-auto rounded-lg border border-stone bg-white p-3 text-xs font-mono text-ink">
                                {row.meta == null
                                  ? "null"
                                  : JSON.stringify(row.meta, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone px-4 py-3 text-sm text-muted">
            <span>
              {total === 0
                ? "Showing 0 entries"
                : `Showing ${start}–${end} of ${total} entries`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page <= 1}
                onClick={() => void fetchLog(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page >= totalPages}
                onClick={() => void fetchLog(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
