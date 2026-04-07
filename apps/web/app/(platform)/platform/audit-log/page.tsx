import { AuditLogClient } from "./AuditLogClient";
import { platformApi } from "@/lib/admin-api";

export default async function PlatformAuditLogPage() {
  const res = await platformApi(`/audit-log?page=1&limit=50`);
  const data = res.ok
    ? await res.json()
    : { entries: [], page: 1, limit: 50, total: 0 };

  return (
    <AuditLogClient
      initialEntries={data.entries ?? []}
      initialPage={data.page ?? 1}
      initialLimit={data.limit ?? 50}
      initialTotal={data.total ?? 0}
    />
  );
}
