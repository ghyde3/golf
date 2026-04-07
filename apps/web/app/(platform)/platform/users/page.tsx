import { platformApi } from "@/lib/admin-api";
import { UsersClient, type PlatformUserRow } from "./UsersClient";

export default async function PlatformUsersPage() {
  const res = await platformApi("/users?page=1&limit=50");
  const data = res.ok
    ? ((await res.json()) as {
        users: PlatformUserRow[];
        page: number;
        limit: number;
        total: number;
      })
    : { users: [] as PlatformUserRow[], page: 1, limit: 50, total: 0 };

  return (
    <UsersClient
      initialUsers={data.users ?? []}
      initialPage={data.page ?? 1}
      initialLimit={data.limit ?? 50}
      initialTotal={data.total ?? 0}
    />
  );
}
