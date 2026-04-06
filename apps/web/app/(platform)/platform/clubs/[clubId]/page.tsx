import { ClubDetailView } from "@/components/platform/ClubDetailView";
import type { ClubDetailPayload } from "@/components/platform/ClubDetailView";
import { platformApi } from "@/lib/admin-api";
import Link from "next/link";

export default async function PlatformClubDetailPage({
  params,
}: {
  params: { clubId: string };
}) {
  const res = await platformApi(`/clubs/${params.clubId}`);
  if (!res.ok) {
    return (
      <div className="p-6">
        <Link
          href="/platform/clubs"
          className="text-sm font-medium text-fairway hover:underline"
        >
          ← Clubs
        </Link>
        <p className="mt-8 text-muted">Club not found.</p>
      </div>
    );
  }

  const raw = (await res.json()) as ClubDetailPayload;
  return <ClubDetailView club={raw} />;
}
