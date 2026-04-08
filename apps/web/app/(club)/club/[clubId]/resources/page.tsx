import { ResourcesClient } from "./ResourcesClient";
import { clubApi } from "@/lib/admin-api";
import type { ResourceTypeRow } from "@/lib/resource-types";

export default async function ClubResourcesPage({
  params,
}: {
  params: { clubId: string };
}) {
  const res = await clubApi(params.clubId, "/resources");
  if (!res.ok) {
    return (
      <p className="p-6 text-muted">
        Could not load resources. You may not have access.
      </p>
    );
  }
  const resources = (await res.json()) as ResourceTypeRow[];
  return <ResourcesClient clubId={params.clubId} resources={resources} />;
}
