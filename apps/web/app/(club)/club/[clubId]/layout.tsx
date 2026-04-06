import { auth } from "@/auth";
import { ClubShell } from "@/components/club/ClubShell";
import { apiBaseUrl, getSessionToken } from "../../../../lib/server-session";
import { redirect } from "next/navigation";

type Context = {
  isPlatformAdmin: boolean;
  clubs: { id: string; name: string; slug: string }[];
};

export default async function ClubShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { clubId: string };
}) {
  const token = await getSessionToken();
  if (!token) {
    redirect(`/login?next=/club/${params.clubId}/dashboard`);
  }

  const res = await fetch(`${apiBaseUrl()}/api/auth/context`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    redirect("/login?next=/club");
  }

  const ctx = (await res.json()) as Context;
  if (!ctx.isPlatformAdmin) {
    const allowedIds = new Set(ctx.clubs.map((c) => c.id));
    if (!allowedIds.has(params.clubId)) {
      redirect("/login?error=forbidden");
    }
  }

  let current = ctx.clubs.find((c) => c.id === params.clubId);
  if (!current && ctx.isPlatformAdmin) {
    const detail = await fetch(
      `${apiBaseUrl()}/api/platform/clubs/${params.clubId}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (detail.ok) {
      const d = (await detail.json()) as {
        id: string;
        name: string;
        slug: string;
      };
      current = { id: d.id, name: d.name, slug: d.slug };
    }
  }

  const session = await auth();
  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "User";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <ClubShell
      clubId={params.clubId}
      clubSlug={current?.slug ?? "club"}
      clubs={ctx.clubs}
      userName={displayName}
      userInitials={initials}
      roles={session?.user?.roles ?? []}
      isPlatformAdmin={ctx.isPlatformAdmin}
    >
      {children}
    </ClubShell>
  );
}
