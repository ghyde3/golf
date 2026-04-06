import { PlatformClubsTable } from "@/components/platform/PlatformClubsTable";
import { PlatformClubsTopBar } from "@/components/platform/PlatformClubsTopBar";
import { platformApi } from "@/lib/admin-api";

export default async function PlatformClubsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const limit = 20;
  const res = await platformApi(`/clubs?page=${page}&limit=${limit}`);
  const data = res.ok
    ? await res.json()
    : { clubs: [], total: 0, page: 1, limit };

  return (
    <>
      <PlatformClubsTopBar />
      <div className="p-6">
        <p className="mb-5 text-sm text-muted">
          Provision and manage tenant golf clubs.
        </p>
        <PlatformClubsTable
          clubs={data.clubs}
          page={data.page ?? page}
          total={data.total ?? 0}
          limit={data.limit ?? limit}
        />
      </div>
    </>
  );
}
