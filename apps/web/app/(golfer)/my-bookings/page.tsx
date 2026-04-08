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
  clubId: string;
  courseId: string;
  holes: number;
};

export type MeBookingItem = {
  id: string;
  bookingRef: string;
  status: string;
  playersCount: number;
  createdAt: string;
  isCancellable: boolean;
  /** Green fee (current club rate × players) + add-on lines from booking. */
  totalCents: number;
  paymentStatus: string;
  teeSlot: MeBookingTeeSlot;
};

export type MeBookingsResponse = {
  upcoming: MeBookingItem[];
  past: MeBookingItem[];
  total: number;
};

export type ScorecardItem = {
  id: string;
  totalScore: number;
  completedHoles: number;
  createdAt: string | null;
  holes: { holeNumber: number; score: number }[];
  booking: {
    bookingRef: string;
    teeSlot: {
      datetime: string;
      courseName: string;
      clubName: string;
      clubId: string;
      courseId: string;
    } | null;
  } | null;
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

  const scRes = await fetch(`${apiBaseUrl()}/api/me/scorecards`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const scorecards = scRes.ok ? ((await scRes.json()) as ScorecardItem[]) : [];

  return (
    <MyBookingsClient
      initialData={data}
      initialScorecards={scorecards}
      accessToken={token}
    />
  );
}
