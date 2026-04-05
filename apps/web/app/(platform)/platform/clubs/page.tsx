import Link from "next/link";
import { platformApi } from "../../../../lib/admin-api";

type ClubRow = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  createdAt: string | null;
  coursesCount: number;
};

export default async function PlatformClubsPage() {
  const res = await platformApi("/clubs?limit=100");
  const data = res.ok
    ? ((await res.json()) as { clubs: ClubRow[] })
    : { clubs: [] };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Clubs</h1>
          <p className="text-slate-400 text-sm mt-1">
            Provision and manage tenant golf clubs.
          </p>
        </div>
        <Link
          href="/platform/clubs/new"
          className="inline-flex justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          New club
        </Link>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Courses</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {data.clubs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No clubs loaded (check API or sign in).
                </td>
              </tr>
            ) : (
              data.clubs.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-800/80 hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/platform/clubs/${c.id}`}
                      className="text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                    {c.slug}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status ?? "active"} />
                  </td>
                  <td className="px-4 py-3 text-slate-300">{c.coursesCount}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {c.createdAt
                      ? new Date(c.createdAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const suspended = status === "suspended";
  return (
    <span
      className={
        suspended
          ? "inline-flex rounded-full bg-amber-500/15 text-amber-400 px-2 py-0.5 text-xs font-medium"
          : "inline-flex rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-xs font-medium"
      }
    >
      {suspended ? "Suspended" : "Active"}
    </span>
  );
}
