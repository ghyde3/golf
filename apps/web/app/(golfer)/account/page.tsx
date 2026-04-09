import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { apiBaseUrl, getSessionToken } from "@/lib/server-session";
import type { MeBookingsResponse, ScorecardItem } from "@/lib/golfer-types";
import AccountClient from "./AccountClient";

export type ProfileData = {
  name: string | null;
  email: string;
  phone: string | null;
  createdAt?: string | null;
  notificationPrefs: { reminders: boolean } | null;
};

const BOOKINGS_PAGE_SIZE = 10;

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { upPage?: string; pastPage?: string };
}) {
  const session = await auth();
  const token = await getSessionToken();
  if (!session?.user || !token) {
    redirect("/login?redirect=/account");
  }

  const upPage = parsePage(searchParams.upPage);
  const pastPage = parsePage(searchParams.pastPage);
  const limit = BOOKINGS_PAGE_SIZE;

  const base = apiBaseUrl();

  const [profileRes, upcomingRes, pastRes, scRes] = await Promise.all([
    fetch(`${base}/api/me/profile`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(
      `${base}/api/me/bookings?upcoming=true&page=${upPage}&limit=${limit}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      }
    ),
    fetch(
      `${base}/api/me/bookings?upcoming=false&page=${pastPage}&limit=${limit}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      }
    ),
    fetch(`${base}/api/me/scorecards`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (profileRes.status === 401) redirect("/login?redirect=/account");
  if (!profileRes.ok) throw new Error("Could not load profile");

  const profile = (await profileRes.json()) as ProfileData;

  if (!upcomingRes.ok || !pastRes.ok) {
    throw new Error("Could not load bookings");
  }

  const upcomingJson = (await upcomingRes.json()) as MeBookingsResponse;
  const pastJson = (await pastRes.json()) as MeBookingsResponse;

  const scorecards = scRes.ok ? ((await scRes.json()) as ScorecardItem[]) : [];

  return (
    <AccountClient
      profile={profile}
      accessToken={token}
      scorecards={scorecards}
      bookings={{
        upcoming: upcomingJson.upcoming,
        past: pastJson.past,
        totalUpcoming: upcomingJson.total,
        totalPast: pastJson.total,
        upPage,
        pastPage,
        limit,
      }}
    />
  );
}
