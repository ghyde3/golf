import { clubApi } from "@/lib/admin-api";
import { StaffClient, type StaffRow } from "./StaffClient";

export default async function ClubStaffPage({
  params,
}: {
  params: { clubId: string };
}) {
  const res = await clubApi(params.clubId, "/staff");
  if (!res.ok) {
    return (
      <p className="p-6 text-muted">
        Could not load staff. You may not have access.
      </p>
    );
  }
  const staff = (await res.json()) as StaffRow[];
  return <StaffClient clubId={params.clubId} staff={staff} />;
}
