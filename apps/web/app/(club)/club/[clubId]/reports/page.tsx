import { clubManageApi } from "@/lib/admin-api";
import { ReportsClient, type ReportsPayload } from "./ReportsClient";

function parseDays(raw: string | string[] | undefined): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== "string") return 30;
  const n = Number.parseInt(s, 10);
  if (Number.isNaN(n)) return 30;
  return Math.min(90, Math.max(1, n));
}

export default async function ClubReportsPage({
  params,
  searchParams,
}: {
  params: { clubId: string };
  searchParams?: { days?: string | string[] };
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
