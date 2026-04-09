import { redirect } from "next/navigation";

/** Legacy URL — bookings live on `/account` (see `#bookings` or `?section=bookings`). */
export default function MyBookingsRedirect() {
  redirect("/account?section=bookings");
}
