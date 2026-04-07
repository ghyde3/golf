"use client";

import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export type ClubBillingRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionType: string;
  bookingFee: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

const SUB_TYPES = ["trial", "basic", "premium"] as const;

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        active
          ? "bg-emerald-100 text-emerald-800"
          : "bg-stone/80 text-ink/70"
      )}
    >
      {status}
    </span>
  );
}

export function SubscriptionsClient({
  initialClubs,
  loadFailed,
}: {
  initialClubs: ClubBillingRow[];
  loadFailed?: boolean;
}) {
  const [clubs, setClubs] = useState(initialClubs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ClubBillingRow>>({});
  const [saving, setSaving] = useState(false);

  function startEdit(row: ClubBillingRow) {
    setEditingId(row.id);
    setDraft({
      subscriptionType: row.subscriptionType,
      bookingFee: row.bookingFee,
      stripeCustomerId: row.stripeCustomerId ?? "",
      stripeSubscriptionId: row.stripeSubscriptionId ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  async function saveEdit(row: ClubBillingRow) {
    setSaving(true);
    try {
      const cust = (draft.stripeCustomerId ?? row.stripeCustomerId ?? "").trim();
      const sub = (draft.stripeSubscriptionId ?? row.stripeSubscriptionId ?? "").trim();
      const body = {
        subscriptionType: draft.subscriptionType ?? row.subscriptionType,
        bookingFee: draft.bookingFee ?? row.bookingFee,
        stripeCustomerId: cust === "" ? null : cust,
        stripeSubscriptionId: sub === "" ? null : sub,
      };

      const res = await fetch(
        `/api/platform/billing/subscriptions/${encodeURIComponent(row.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        subscriptionType?: string;
        bookingFee?: string;
        stripeCustomerId?: string | null;
        stripeSubscriptionId?: string | null;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save");
        return;
      }
      setClubs((prev) =>
        prev.map((c) =>
          c.id === row.id
            ? {
                ...c,
                subscriptionType: data.subscriptionType ?? c.subscriptionType,
                bookingFee: data.bookingFee ?? c.bookingFee,
                stripeCustomerId:
                  data.stripeCustomerId !== undefined
                    ? data.stripeCustomerId
                    : c.stripeCustomerId,
                stripeSubscriptionId:
                  data.stripeSubscriptionId !== undefined
                    ? data.stripeSubscriptionId
                    : c.stripeSubscriptionId,
              }
            : c
        )
      );
      toast.success("Saved");
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SetPlatformTopBar
        title="Subscriptions"
        backLink={{ href: "/platform/billing", label: "← Billing" }}
      />
      <div className="p-6">
        {loadFailed && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Could not load clubs. Showing empty list.
          </p>
        )}
        <p className="mb-5 text-sm text-muted">
          Edit subscription type, booking fee, and Stripe identifiers per club.
        </p>

        <div className="overflow-x-auto rounded-xl border border-stone bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-stone bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Club name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Booking fee</th>
                <th className="px-4 py-3">Stripe customer</th>
                <th className="px-4 py-3">Stripe subscription</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clubs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted"
                  >
                    No clubs found.
                  </td>
                </tr>
              ) : (
                clubs.map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-stone/80 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-ink">
                        {row.name}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            className="h-9 w-full max-w-[140px] rounded-md border border-stone bg-white px-2 text-sm"
                            value={draft.subscriptionType ?? row.subscriptionType}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                subscriptionType: e.target.value,
                              }))
                            }
                          >
                            {SUB_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-ink">{row.subscriptionType}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-9 max-w-[120px]"
                            value={draft.bookingFee ?? row.bookingFee}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                bookingFee: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <span className="text-ink">${row.bookingFee}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            className="h-9 font-mono text-xs"
                            value={
                              draft.stripeCustomerId ??
                              row.stripeCustomerId ??
                              ""
                            }
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                stripeCustomerId: e.target.value,
                              }))
                            }
                            placeholder="cus_…"
                          />
                        ) : (
                          <span className="font-mono text-xs text-muted">
                            {row.stripeCustomerId ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            className="h-9 font-mono text-xs"
                            value={
                              draft.stripeSubscriptionId ??
                              row.stripeSubscriptionId ??
                              ""
                            }
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                stripeSubscriptionId: e.target.value,
                              }))
                            }
                            placeholder="sub_…"
                          />
                        ) : (
                          <span className="font-mono text-xs text-muted">
                            {row.stripeSubscriptionId ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={saving}
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={saving}
                              onClick={() => void saveEdit(row)}
                            >
                              Save
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
