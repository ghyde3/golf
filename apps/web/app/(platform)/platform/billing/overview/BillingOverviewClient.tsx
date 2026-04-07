"use client";

import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";

export type BillingOverviewData = {
  totalRevenueCents: number;
  paidInvoicesCount: number;
  pendingAmountCents: number;
  activeClubsCount: number;
  monthlyBreakdown: { month: string; amountCents: number; count: number }[];
};

function fmtDollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })}`;
}

export function BillingOverviewClient({
  data,
  loadFailed,
}: {
  data: BillingOverviewData;
  loadFailed?: boolean;
}) {
  return (
    <>
      <SetPlatformTopBar
        title="Billing overview"
        backLink={{ href: "/platform/billing", label: "← Billing" }}
      />
      <div className="p-6">
        {loadFailed && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Could not load billing metrics. Showing zeros.
          </p>
        )}
        <p className="mb-5 text-sm text-muted">
          Aggregate revenue from paid invoices and club activity.
        </p>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total revenue", value: fmtDollars(data.totalRevenueCents) },
            { label: "Paid invoices", value: String(data.paidInvoicesCount) },
            { label: "Pending amount", value: fmtDollars(data.pendingAmountCents) },
            { label: "Active clubs", value: String(data.activeClubsCount) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-stone bg-white p-5 shadow-sm"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                {label}
              </p>
              <p className="mt-2 font-display text-2xl text-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-stone bg-white shadow-sm">
          <div className="border-b border-stone px-5 py-4">
            <h2 className="font-display text-lg text-ink">Monthly breakdown</h2>
            <p className="mt-1 text-sm text-muted">
              Paid invoice totals by billing period start (last 12 months).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">Month</th>
                  <th className="px-5 py-3">Revenue</th>
                  <th className="px-5 py-3">Invoice count</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyBreakdown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-muted"
                    >
                      No paid invoice data yet.
                    </td>
                  </tr>
                ) : (
                  data.monthlyBreakdown.map((row) => (
                    <tr
                      key={row.month}
                      className="border-b border-stone/80 last:border-0"
                    >
                      <td className="px-5 py-3 font-medium text-ink">
                        {row.month}
                      </td>
                      <td className="px-5 py-3 text-ink">
                        {fmtDollars(row.amountCents)}
                      </td>
                      <td className="px-5 py-3 text-muted">{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
