import { platformApi } from "@/lib/admin-api";
import { StripeSettingsClient } from "./StripeSettingsClient";

export default async function PlatformBillingStripePage() {
  const res = await platformApi("/settings");
  const data = res.ok
    ? ((await res.json()) as { settings: Record<string, unknown> })
    : { settings: {} as Record<string, unknown> };

  return (
    <StripeSettingsClient
      initialSettings={data.settings ?? {}}
      loadFailed={!res.ok}
    />
  );
}
