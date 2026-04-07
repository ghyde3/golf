import { GeneralSettingsClient } from "./GeneralSettingsClient";
import { platformApi } from "@/lib/admin-api";

export default async function PlatformGeneralSettingsPage() {
  const res = await platformApi("/settings");
  const data = res.ok
    ? ((await res.json()) as { settings: Record<string, unknown> })
    : { settings: {} as Record<string, unknown> };

  return <GeneralSettingsClient initialSettings={data.settings ?? {}} />;
}
