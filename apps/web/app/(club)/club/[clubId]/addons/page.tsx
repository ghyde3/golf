import { AddonsClient } from "./AddonsClient";
import { clubApi } from "@/lib/admin-api";
import type { ResourceTypeRow } from "@/lib/resource-types";

export type AddonCatalogRow = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  sortOrder: number;
  unitsConsumed: number;
  taxable: boolean;
  active: boolean;
  resourceTypeId: string | null;
  resourceTypeName: string | null;
};

export default async function ClubAddonsPage({
  params,
}: {
  params: { clubId: string };
}) {
  const [addonsRes, resourcesRes] = await Promise.all([
    clubApi(params.clubId, "/addons"),
    clubApi(params.clubId, "/resources"),
  ]);

  if (!addonsRes.ok) {
    return (
      <p className="p-6 text-muted">
        Could not load add-ons. You may not have access.
      </p>
    );
  }

  const addons = (await addonsRes.json()) as AddonCatalogRow[];
  const resources = resourcesRes.ok
    ? ((await resourcesRes.json()) as ResourceTypeRow[])
    : [];

  return <AddonsClient clubId={params.clubId} initialAddons={addons} resourceTypes={resources} />;
}
