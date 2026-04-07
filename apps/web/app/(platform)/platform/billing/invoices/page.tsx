import { platformApi } from "@/lib/admin-api";
import { InvoicesClient } from "./InvoicesClient";

export default async function PlatformBillingInvoicesPage() {
  const res = await platformApi("/invoices?page=1&limit=20");
  const data = res.ok
    ? ((await res.json()) as {
        invoices: {
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
        }[];
        page: number;
        limit: number;
        total: number;
      })
    : { invoices: [], page: 1, limit: 20, total: 0 };

  return <InvoicesClient initial={data} loadFailed={!res.ok} />;
}
