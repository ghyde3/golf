import { auth } from "@/auth";
import { ConfirmBookingClient } from "./ConfirmBookingClient";

export default async function ConfirmPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  const showGuestRegistrationBanner = !session?.user;

  return <ConfirmBookingClient params={params} showGuestRegistrationBanner={showGuestRegistrationBanner} />;
}
