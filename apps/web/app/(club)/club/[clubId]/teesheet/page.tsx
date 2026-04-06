import { clubManageApi } from "@/lib/admin-api";
import { Suspense } from "react";
import { TeesheetPageClient } from "./TeesheetPageClient";

export default async function TeeSheetPage({
  params,
}: {
  params: { clubId: string };
}) {
  const res = await clubManageApi(params.clubId, "/summary");
  const slug = res.ok
    ? ((await res.json()) as { slug: string }).slug
    : "club";

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-muted">
          Loading…
        </div>
      }
    >
      <TeesheetPageClient clubId={params.clubId} clubSlug={slug} />
    </Suspense>
  );
}
