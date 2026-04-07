import { platformApi } from "@/lib/admin-api";
import {
  AnnouncementsClient,
  type PlatformAnnouncementRow,
} from "./AnnouncementsClient";

export default async function PlatformAnnouncementsPage() {
  const res = await platformApi("/announcements?page=1&limit=20");
  const data = res.ok
    ? ((await res.json()) as {
        announcements: PlatformAnnouncementRow[];
        page: number;
        limit: number;
        total: number;
      })
    : {
        announcements: [] as PlatformAnnouncementRow[],
        page: 1,
        limit: 20,
        total: 0,
      };

  return (
    <AnnouncementsClient
      initialAnnouncements={data.announcements ?? []}
      initialPage={data.page}
      initialLimit={data.limit}
      initialTotal={data.total}
    />
  );
}
