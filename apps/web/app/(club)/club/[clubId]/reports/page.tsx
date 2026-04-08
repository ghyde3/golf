import { clubManageApi } from "@/lib/admin-api";
import { ReportsClient, type ReportsPayload } from "./ReportsClient";

function parseDays(raw: string | undefined): number {
  if (raw === "7" || raw === "30" || raw === "90") return Number(raw);
  return 30;
}

export default async function ClubReportsPage({
  params,
  searchParams,
}: {
  params: { clubId: string };
  searchParams?: { days?: string };
}) {
  const days = parseDays(searchParams?.days);
  const res = await clubManageApi(params.clubId, `/reports?days=${days}`);
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
