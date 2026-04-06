import { clubApi, clubManageApi } from "@/lib/admin-api";
import {
  parseBookingsSearchParams,
  toManageBookingsApiQuery,
} from "./bookings-query";
import { BookingsClient, type ClubBookingRow } from "./BookingsClient";

type BookingsApiPayload = {
  bookings?: ClubBookingRow[];
  total?: number;
  page?: number;
  limit?: number;
};

export default async function ClubBookingsPage({
  params,
  searchParams,
}: {
  params: { clubId: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = parseBookingsSearchParams(searchParams);
  const qs = toManageBookingsApiQuery(query);
  const res = await clubManageApi(
    params.clubId,
    qs ? `/bookings?${qs}` : "/bookings"
  );
  if (!res.ok) {
    return (
      <p className="p-6 text-muted">
        Could not load bookings. You may not have access.
      </p>
    );
  }

  const data = (await res.json()) as BookingsApiPayload;
  const bookings = Array.isArray(data.bookings) ? data.bookings : [];
  const total = typeof data.total === "number" ? data.total : bookings.length;
  const page = typeof data.page === "number" ? data.page : 1;
  const limit = typeof data.limit === "number" ? data.limit : 25;

  const coursesRes = await clubApi(params.clubId, "/courses");
  const courses = coursesRes.ok
    ? ((await coursesRes.json()) as { id: string; name: string }[])
    : [];

  return (
    <BookingsClient
      clubId={params.clubId}
      bookings={bookings}
      total={total}
      page={page}
      limit={limit}
      query={query}
      courses={courses}
    />
  );
}
