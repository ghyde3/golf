import { SecuritySettingsClient } from "./SecuritySettingsClient";
import { platformApi } from "@/lib/admin-api";

export default async function PlatformSecuritySettingsPage() {
  const res = await platformApi("/settings");
  const data = res.ok
    ? ((await res.json()) as { settings: Record<string, unknown> })
    : { settings: {} as Record<string, unknown> };

  return <SecuritySettingsClient initialSettings={data.settings ?? {}} />;
}
