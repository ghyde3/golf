import { RecentClubsTable } from "@/components/platform/RecentClubsTable";
import { PlatformStatCard } from "@/components/platform/PlatformStatCard";
import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import { platformApi } from "@/lib/admin-api";
import Link from "next/link";

type Stats = {
  totalClubs: number;
  activeClubs: number;
  totalBookingsToday: number;
  totalBookingsThisMonth: number;
};

type ClubsPayload = {
  clubs: {
    id: string;
    name: string;
    slug: string;
    status: string | null;
    coursesCount: number;
    createdAt: string | null;
  }[];
};

export default async function PlatformHomePage() {
  const [statsRes, clubsRes] = await Promise.all([
    platformApi("/stats"),
    platformApi("/clubs?limit=5"),
  ]);

  const stats: Stats = statsRes.ok
    ? ((await statsRes.json()) as Stats)
    : {
        totalClubs: 0,
        activeClubs: 0,
        totalBookingsToday: 0,
        totalBookingsThisMonth: 0,
      };

  const recent = clubsRes.ok
    ? ((await clubsRes.json()) as ClubsPayload).clubs
    : [];

  const suspendedGuess = Math.max(0, stats.totalClubs - stats.activeClubs);

  return (
    <>
      <SetPlatformTopBar title="Dashboard" />
      <div className="flex flex-col gap-5 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <PlatformStatCard
            label="Total clubs"
            value={stats.totalClubs}
            borderClass="border-grass"
          />
          <PlatformStatCard
            label="Active clubs"
            value={stats.activeClubs}
            borderClass="border-gold"
          />
          <PlatformStatCard
            label="Bookings today"
            value={stats.totalBookingsToday}
            borderClass="border-blue-400"
          />
          <PlatformStatCard
            label="Bookings this month"
            value={stats.totalBookingsThisMonth}
            borderClass="border-slate-400"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
          <RecentClubsTable clubs={recent} />

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
              <h3 className="font-display text-base text-ink">Quick actions</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" className="border-stone" asChild>
                  <Link href="/platform/clubs/new">Create club</Link>
                </Button>
                <Button variant="secondary" className="border-stone" asChild>
                  <Link href="/platform/clubs">View all clubs</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
              <h3 className="font-display text-base text-ink">
                System health
              </h3>
              <ul className="mt-3 space-y-3 text-sm">
                <li className="flex gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green-500" />
                  <span className="text-ink">
                    {stats.activeClubs} club{stats.activeClubs === 1 ? "" : "s"}{" "}
                    active
                  </span>
                </li>
                {suspendedGuess > 0 ? (
                  <li className="flex gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <span className="text-ink">
                      {suspendedGuess} club
                      {suspendedGuess === 1 ? "" : "s"} suspended
                    </span>
                  </li>
                ) : null}
                <li className="flex gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green-500" />
                  <span className="text-ink">Platform status: Operational</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
