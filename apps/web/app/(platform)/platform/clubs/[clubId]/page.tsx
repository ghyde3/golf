import Link from "next/link";
import { platformApi } from "../../../../../lib/admin-api";
import { ClubStatusToggle } from "./ClubStatusToggle";

type ClubDetail = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  description: string | null;
  createdAt: string | null;
  courses: { id: string; name: string; holes: number }[];
  configs: {
    id: string;
    effectiveFrom: string;
    slotIntervalMinutes: number | null;
    bookingWindowDays: number | null;
    timezone: string | null;
    primaryColor: string | null;
  }[];
  staff: {
    userId: string;
    role: string;
    name: string | null;
    email: string | null;
  }[];
};

export default async function PlatformClubDetailPage({
  params,
}: {
  params: { clubId: string };
}) {
  const res = await platformApi(`/clubs/${params.clubId}`);
  if (!res.ok) {
    return (
      <div>
        <Link href="/platform/clubs" className="text-sm text-slate-400 hover:text-white">
          ← Clubs
        </Link>
        <p className="mt-8 text-slate-400">Club not found.</p>
      </div>
    );
  }
  const club = (await res.json()) as ClubDetail;

  return (
    <div>
      <Link
        href="/platform/clubs"
        className="text-sm text-slate-400 hover:text-white mb-6 inline-block"
      >
        ← Clubs
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">{club.name}</h1>
          <p className="text-slate-400 font-mono text-sm mt-1">{club.slug}</p>
          {club.description && (
            <p className="text-slate-300 text-sm mt-3 max-w-xl">{club.description}</p>
          )}
        </div>
        <ClubStatusToggle clubId={club.id} status={club.status ?? "active"} />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-medium text-white mb-3">Courses</h2>
          <ul className="rounded-xl border border-slate-800 divide-y divide-slate-800 bg-slate-900">
            {club.courses.length === 0 ? (
              <li className="px-4 py-6 text-slate-500 text-sm">No courses yet.</li>
            ) : (
              club.courses.map((c) => (
                <li key={c.id} className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-slate-200">{c.name}</span>
                  <span className="text-slate-500">{c.holes} holes</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium text-white mb-3">Staff</h2>
          <ul className="rounded-xl border border-slate-800 divide-y divide-slate-800 bg-slate-900">
            {club.staff.length === 0 ? (
              <li className="px-4 py-6 text-slate-500 text-sm">No staff assigned.</li>
            ) : (
              club.staff.map((s) => (
                <li key={`${s.userId}-${s.role}`} className="px-4 py-3 text-sm">
                  <span className="text-slate-200">{s.name ?? s.email}</span>
                  <span className="text-slate-500 ml-2 text-xs uppercase">
                    {s.role.replace("_", " ")}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-white mb-3">Config history</h2>
        <div className="rounded-xl border border-slate-800 overflow-x-auto bg-slate-900">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Effective from</th>
                <th className="px-4 py-3 font-medium">Interval (min)</th>
                <th className="px-4 py-3 font-medium">Booking window (days)</th>
                <th className="px-4 py-3 font-medium">Timezone</th>
                <th className="px-4 py-3 font-medium">Primary</th>
              </tr>
            </thead>
            <tbody>
              {club.configs.map((cfg) => (
                <tr key={cfg.id} className="border-b border-slate-800/80">
                  <td className="px-4 py-3 text-slate-300">{cfg.effectiveFrom}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {cfg.slotIntervalMinutes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {cfg.bookingWindowDays ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {cfg.timezone ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block w-5 h-5 rounded border border-slate-600"
                      style={{
                        backgroundColor: cfg.primaryColor ?? "#16a34a",
                      }}
                      title={cfg.primaryColor ?? ""}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
