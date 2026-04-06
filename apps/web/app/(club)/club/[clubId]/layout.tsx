import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "../../../../components/LogoutButton";
import { ClubSwitcher } from "../../../../components/ClubSwitcher";
import { apiBaseUrl, getSessionToken } from "../../../../lib/server-session";

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

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 min-w-0">
            <span className="font-semibold text-white truncate">
              {current?.name ?? "Club"}
            </span>
            <nav className="flex flex-wrap gap-3 text-sm">
              <Link
                href={`/club/${params.clubId}/dashboard`}
                className="text-stone-400 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href={`/book/${current?.slug ?? "pinebrook"}`}
                className="text-stone-400 hover:text-white transition-colors"
              >
                Public booking page
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <ClubSwitcher clubId={params.clubId} clubs={ctx.clubs} />
            {ctx.isPlatformAdmin && (
              <Link
                href="/platform"
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Platform
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
