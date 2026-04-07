import { FeatureFlagsClient } from "./FeatureFlagsClient";
import { platformApi } from "@/lib/admin-api";

export default async function PlatformFeatureFlagsPage() {
  const res = await platformApi("/settings");
  const data = res.ok
    ? ((await res.json()) as { settings: Record<string, unknown> })
    : { settings: {} as Record<string, unknown> };

  return <FeatureFlagsClient initialSettings={data.settings ?? {}} />;
}
