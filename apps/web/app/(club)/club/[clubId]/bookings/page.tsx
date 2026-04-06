import { clubManageApi } from "@/lib/admin-api";
import {
  BookingsClient,
  type ClubBookingRow,
} from "./BookingsClient";

export default async function ClubBookingsPage({
  params,
}: {
  params: { clubId: string };
}) {
  const res = await clubManageApi(params.clubId, "/bookings");
  if (!res.ok) {
    return (
      <p className="p-6 text-muted">
        Could not load bookings. You may not have access.
      </p>
    );
  }

  const data = (await res.json()) as { bookings?: ClubBookingRow[] };
  const bookings = Array.isArray(data.bookings) ? data.bookings : [];

  return (
    <BookingsClient clubId={params.clubId} bookings={bookings} />
  );
}
