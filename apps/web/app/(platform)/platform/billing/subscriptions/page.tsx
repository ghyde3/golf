import { platformApi } from "@/lib/admin-api";
import { SubscriptionsClient } from "./SubscriptionsClient";

export default async function PlatformBillingSubscriptionsPage() {
  const res = await platformApi("/billing/subscriptions");
  const data = res.ok
    ? ((await res.json()) as {
        clubs: {
          id: string;
          name: string;
          slug: string;
          status: string;
          subscriptionType: string;
          bookingFee: string;
          stripeCustomerId: string | null;
          stripeSubscriptionId: string | null;
        }[];
      })
    : { clubs: [] };

  return <SubscriptionsClient initialClubs={data.clubs} loadFailed={!res.ok} />;
}
