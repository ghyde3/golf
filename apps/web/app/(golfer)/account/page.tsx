import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { apiBaseUrl, getSessionToken } from "@/lib/server-session";
import type { ScorecardItem } from "../my-bookings/page";
import AccountClient from "./AccountClient";

export type ProfileData = {
  name: string | null;
  email: string;
  phone: string | null;
  notificationPrefs: { reminders: boolean } | null;
};

export default async function AccountPage() {
  const session = await auth();
  const token = await getSessionToken();
  if (!session?.user || !token) {
    redirect("/login?redirect=/account");
  }

  const res = await fetch(`${apiBaseUrl()}/api/me/profile`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) redirect("/login?redirect=/account");
  if (!res.ok) throw new Error("Could not load profile");

  const profile = (await res.json()) as ProfileData;

  const scRes = await fetch(`${apiBaseUrl()}/api/me/scorecards`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const scorecards = scRes.ok ? ((await scRes.json()) as ScorecardItem[]) : [];

  return (
    <AccountClient
      profile={profile}
      accessToken={token}
      scorecards={scorecards}
    />
  );
}
