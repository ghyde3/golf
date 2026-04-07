import { platformApi } from "@/lib/admin-api";
import { BillingOverviewClient } from "./BillingOverviewClient";

export default async function PlatformBillingOverviewPage() {
  const res = await platformApi("/billing/overview");
  const data = res.ok
    ? ((await res.json()) as {
        totalRevenueCents: number;
        paidInvoicesCount: number;
        pendingAmountCents: number;
        activeClubsCount: number;
        monthlyBreakdown: {
          month: string;
          amountCents: number;
          count: number;
        }[];
      })
    : null;

  return (
    <BillingOverviewClient
      data={
        data ?? {
          totalRevenueCents: 0,
          paidInvoicesCount: 0,
          pendingAmountCents: 0,
          activeClubsCount: 0,
          monthlyBreakdown: [],
        }
      }
      loadFailed={!res.ok}
    />
  );
}
