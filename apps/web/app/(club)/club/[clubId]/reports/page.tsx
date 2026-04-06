import { clubManageApi } from "@/lib/admin-api";
import { ReportsClient, type ReportsPayload } from "./ReportsClient";

export default async function ClubReportsPage({
  params,
}: {
  params: { clubId: string };
}) {
  const res = await clubManageApi(params.clubId, "/reports?days=7");
  if (!res.ok) {
    return (
      <p className="p-6 text-muted">
        Could not load reports. You may not have access.
      </p>
    );
  }
  const data = (await res.json()) as ReportsPayload;
  return <ReportsClient clubId={params.clubId} data={data} />;
}
