import { platformApi } from "@/lib/admin-api";
import {
  PlatformTagsClient,
  type PlatformTagRow,
} from "@/components/platform/PlatformTagsClient";

export default async function PlatformTagsPage() {
  const res = await platformApi("/tags");
  const data = res.ok
    ? ((await res.json()) as { tags: PlatformTagRow[] })
    : { tags: [] as PlatformTagRow[] };

  return <PlatformTagsClient initialTags={data.tags ?? []} />;
}
