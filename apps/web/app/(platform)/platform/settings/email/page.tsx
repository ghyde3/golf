import { EmailSettingsClient } from "./EmailSettingsClient";
import { platformApi } from "@/lib/admin-api";

export default async function PlatformEmailSettingsPage() {
  const res = await platformApi("/settings");
  const data = res.ok
    ? ((await res.json()) as { settings: Record<string, unknown> })
    : { settings: {} as Record<string, unknown> };

  return <EmailSettingsClient initialSettings={data.settings ?? {}} />;
}
