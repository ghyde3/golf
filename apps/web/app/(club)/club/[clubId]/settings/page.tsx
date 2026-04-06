import { clubApi } from "@/lib/admin-api";
import { SettingsClient, type ConfigRow } from "./SettingsClient";

export default async function ClubSettingsPage({
  params,
}: {
  params: { clubId: string };
}) {
  const res = await clubApi(params.clubId, "/config");
  if (!res.ok) {
    return (
      <p className="p-6 text-muted">
        Could not load settings. You may not have access.
      </p>
    );
  }
  const configs = (await res.json()) as ConfigRow[];
  return <SettingsClient clubId={params.clubId} configs={configs} />;
}
