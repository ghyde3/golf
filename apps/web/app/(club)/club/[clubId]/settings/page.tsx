import { clubApi } from "@/lib/admin-api";
import { SettingsClient, type ConfigRow } from "./SettingsClient";

export default async function ClubSettingsPage({
  params,
}: {
  params: { clubId: string };
}) {
  const [configRes, profileRes] = await Promise.all([
    clubApi(params.clubId, "/config"),
    clubApi(params.clubId, "/profile"),
  ]);
  if (!configRes.ok) {
    return (
      <p className="p-6 text-muted">
        Could not load settings. You may not have access.
      </p>
    );
  }
  const configs = (await configRes.json()) as ConfigRow[];
  const profile = profileRes.ok
    ? ((await profileRes.json()) as {
        heroImageUrl: string | null;
        bookingFee: string | null;
      })
    : {
        heroImageUrl: null as string | null,
        bookingFee: null as string | null,
      };
  return (
    <SettingsClient
      clubId={params.clubId}
      configs={configs}
      initialHeroImageUrl={profile.heroImageUrl}
      initialBookingFee={profile.bookingFee}
    />
  );
}
