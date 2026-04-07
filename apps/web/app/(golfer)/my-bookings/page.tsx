import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { apiBaseUrl, getSessionToken } from "@/lib/server-session";
import MyBookingsClient from "./MyBookingsClient";

export type MeBookingTeeSlot = {
  datetime: string;
  courseName: string;
  clubName: string;
  clubSlug: string;
  timezone: string;
};

export type MeBookingItem = {
  id: string;
  bookingRef: string;
  status: string;
  playersCount: number;
  createdAt: string;
  isCancellable: boolean;
  teeSlot: MeBookingTeeSlot;
};

export type MeBookingsResponse = {
  upcoming: MeBookingItem[];
  past: MeBookingItem[];
  total: number;
};

export default async function MyBookingsPage() {
  const session = await auth();
  const token = await getSessionToken();
  if (!session?.user || !token) {
    redirect("/login?redirect=/my-bookings");
  }

  const res = await fetch(`${apiBaseUrl()}/api/me/bookings`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    redirect("/login?redirect=/my-bookings");
  }

  if (!res.ok) {
    throw new Error("Could not load bookings");
  }

  const data = (await res.json()) as MeBookingsResponse;
  const email = session.user.email ?? "";

  return (
    <MyBookingsClient
      initialData={data}
      accessToken={token}
      userEmail={email}
    />
  );
}
