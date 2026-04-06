import { redirect } from "next/navigation";
import { apiBaseUrl, getSessionToken } from "../../../lib/server-session";

type Context = {
  clubs: { id: string; name: string; slug: string }[];
};

export default async function ClubEntryPage() {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login");
  }

  const res = await fetch(`${apiBaseUrl()}/api/auth/context`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    redirect("/login");
  }

  const ctx = (await res.json()) as Context;
  const first = ctx.clubs[0];
  if (!first) {
    redirect("/login?error=forbidden");
  }

  redirect(`/club/${first.id}/dashboard`);
}
