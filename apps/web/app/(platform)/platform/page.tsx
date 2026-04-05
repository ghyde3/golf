import Link from "next/link";
import { platformApi } from "../../../lib/admin-api";

export default async function PlatformHomePage() {
  const res = await platformApi("/stats");
  const stats = res.ok
    ? await res.json()
    : {
        totalClubs: "—",
        activeClubs: "—",
        totalBookingsToday: "—",
        totalBookingsThisMonth: "—",
      };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-2">Overview</h1>
      <p className="text-slate-400 text-sm mb-8">
        Internal operations for the TeeTimes platform.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total clubs", value: stats.totalClubs },
          { label: "Active clubs", value: stats.activeClubs },
          { label: "Bookings today", value: stats.totalBookingsToday },
          { label: "Bookings this month", value: stats.totalBookingsThisMonth },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              {c.label}
            </p>
            <p className="text-2xl font-semibold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <Link
        href="/platform/clubs"
        className="inline-flex items-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 transition-colors"
      >
        Manage clubs
      </Link>
    </div>
  );
}
