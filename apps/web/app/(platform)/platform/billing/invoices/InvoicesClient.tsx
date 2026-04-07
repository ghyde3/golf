"use client";

import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export type PlatformInvoiceRow = {
  id: string;
  clubId: string;
  clubName: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  status: string;
  stripeInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
};

function fmtDollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })}`;
}

function StatusBadge({ status }: { status: string }) {
  const base =
    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide";
  if (status === "draft") {
    return <span className={cn(base, "bg-stone/80 text-ink/80")}>draft</span>;
  }
  if (status === "sent") {
    return (
      <span className={cn(base, "bg-sky-100 text-sky-800")}>sent</span>
    );
  }
  if (status === "paid") {
    return (
      <span className={cn(base, "bg-emerald-100 text-emerald-800")}>paid</span>
    );
  }
  if (status === "void") {
    return (
      <span
        className={cn(
          base,
          "bg-slate-200 text-slate-600 line-through decoration-slate-500"
        )}
      >
        void
      </span>
    );
  }
  return <span className={cn(base, "bg-stone/60 text-ink")}>{status}</span>;
}

export function InvoicesClient({
  initial,
  loadFailed,
}: {
  initial: {
    invoices: PlatformInvoiceRow[];
    page: number;
    limit: number;
    total: number;
  };
  loadFailed?: boolean;
}) {
  const [invoices, setInvoices] = useState(initial.invoices);
  const [page, setPage] = useState(initial.page);
  const [limit] = useState(initial.limit);
  const [total, setTotal] = useState(initial.total);
  const [clubIdInput, setClubIdInput] = useState("");
  const [statusSelect, setStatusSelect] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createClubId, setCreateClubId] = useState("");
  const [createStart, setCreateStart] = useState("");
  const [createEnd, setCreateEnd] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [creating, setCreating] = useState(false);

  async function fetchList(nextPage: number) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("limit", String(limit));
      if (clubIdInput.trim()) params.set("clubId", clubIdInput.trim());
      if (statusSelect !== "all") params.set("status", statusSelect);
      const res = await fetch(`/api/platform/invoices?${params.toString()}`);
      const data = (await res.json()) as {
        invoices?: PlatformInvoiceRow[];
        page?: number;
        total?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to load invoices");
        return;
      }
      setInvoices(data.invoices ?? []);
      setPage(data.page ?? nextPage);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    void fetchList(1);
  }

  async function patchInvoice(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/platform/invoices/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
    } & PlatformInvoiceRow;
    if (!res.ok) {
      toast.error(data.error ?? "Update failed");
      return null;
    }
    return data;
  }

  async function markSent(row: PlatformInvoiceRow) {
    const updated = await patchInvoice(row.id, { status: "sent" });
    if (updated) {
      setInvoices((prev) =>
        prev.map((i) => (i.id === row.id ? { ...i, ...updated } : i))
      );
      toast.success("Marked sent");
    }
  }

  async function markPaid(row: PlatformInvoiceRow) {
    const updated = await patchInvoice(row.id, { status: "paid" });
    if (updated) {
      setInvoices((prev) =>
        prev.map((i) => (i.id === row.id ? { ...i, ...updated } : i))
      );
      toast.success("Marked paid");
    }
  }

  async function voidInvoice(row: PlatformInvoiceRow) {
    if (
      !window.confirm(
        `Void invoice for ${row.clubName} (${row.periodStart}–${row.periodEnd})?`
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/platform/invoices/${encodeURIComponent(row.id)}/void`,
      { method: "POST" }
    );
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
    } & PlatformInvoiceRow;
    if (res.status === 409) {
      toast.error(data.error ?? "Cannot void this invoice");
      return;
    }
    if (!res.ok) {
      toast.error(data.error ?? "Void failed");
      return;
    }
    setInvoices((prev) =>
      prev.map((i) => (i.id === row.id ? { ...i, ...data } : i))
    );
    toast.success("Invoice voided");
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    const dollars = parseFloat(createAmount);
    if (Number.isNaN(dollars) || dollars < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const amountCents = Math.round(dollars * 100);
    setCreating(true);
    try {
      const res = await fetch("/api/platform/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId: createClubId.trim(),
          periodStart: createStart,
          periodEnd: createEnd,
          amountCents,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create invoice");
        return;
      }
      toast.success("Invoice created");
      setCreateOpen(false);
      setCreateClubId("");
      setCreateStart("");
      setCreateEnd("");
      setCreateAmount("");
      await fetchList(1);
    } finally {
      setCreating(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <SetPlatformTopBar
        title="Invoices"
        backLink={{ href: "/platform/billing", label: "← Billing" }}
      />
      <div className="p-6">
        {loadFailed && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Initial load failed. Use filters to retry.
          </p>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label
                htmlFor="inv-club-id"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted"
              >
                Club ID
              </label>
              <Input
                id="inv-club-id"
                className="h-9 w-full min-w-[200px] sm:w-64"
                value={clubIdInput}
                onChange={(e) => setClubIdInput(e.target.value)}
                placeholder="UUID"
              />
            </div>
            <div>
              <label
                htmlFor="inv-status"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted"
              >
                Status
              </label>
              <select
                id="inv-status"
                className="h-9 rounded-md border border-stone bg-white px-2 text-sm"
                value={statusSelect}
                onChange={(e) => setStatusSelect(e.target.value)}
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="void">Void</option>
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void applyFilters()}
            >
              Apply
            </Button>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Create invoice
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-stone bg-white shadow-sm">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-stone bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Stripe invoice</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted"
                  >
                    No invoices match.
                  </td>
                </tr>
              ) : (
                invoices.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-stone/80 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{row.clubName}</div>
                      <div className="font-mono text-[11px] text-muted">
                        {row.clubId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {row.periodStart} → {row.periodEnd}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {fmtDollars(row.amountCents)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {row.stripeInvoiceId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {row.status === "draft" && (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => void markSent(row)}
                            >
                              Mark sent
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void voidInvoice(row)}
                            >
                              Void
                            </Button>
                          </>
                        )}
                        {row.status === "sent" && (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => void markPaid(row)}
                            >
                              Mark paid
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void voidInvoice(row)}
                            >
                              Void
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted">
          <span>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => void fetchList(page - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || page >= totalPages}
              onClick={() => void fetchList(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
            <DialogDescription>
              Creates a draft invoice for the club and period you specify.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createInvoice} className="space-y-4">
            <div>
              <label
                htmlFor="c-club"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted"
              >
                Club ID
              </label>
              <Input
                id="c-club"
                required
                value={createClubId}
                onChange={(e) => setCreateClubId(e.target.value)}
                placeholder="UUID"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="c-start"
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted"
                >
                  Period start
                </label>
                <Input
                  id="c-start"
                  type="date"
                  required
                  value={createStart}
                  onChange={(e) => setCreateStart(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="c-end"
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted"
                >
                  Period end
                </label>
                <Input
                  id="c-end"
                  type="date"
                  required
                  value={createEnd}
                  onChange={(e) => setCreateEnd(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="c-amt"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted"
              >
                Amount (USD)
              </label>
              <Input
                id="c-amt"
                type="number"
                step="0.01"
                min="0"
                required
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
