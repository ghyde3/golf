import { SearchClient } from "./SearchClient";
import { publicApiUrl } from "@/lib/public-api-url";
import type { PublicClubListItem } from "@/components/home/types";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; date?: string; players?: string; sort?: string };
}) {
  const sp = searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sort = sp.sort === "new" ? "new" : undefined;
  const date =
    typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : new Date().toISOString().split("T")[0];
  const playersRaw = typeof sp.players === "string" ? Number.parseInt(sp.players, 10) : 2;
  const players = Number.isFinite(playersRaw)
    ? Math.min(4, Math.max(1, playersRaw))
    : 2;

  const api = publicApiUrl();
  const url = new URL(`${api}/api/clubs/public`);
  if (q) url.searchParams.set("q", q);
  if (sort) url.searchParams.set("sort", sort);
  url.searchParams.set("limit", "20");

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = res.ok
    ? ((await res.json()) as { clubs: PublicClubListItem[] })
    : { clubs: [] as PublicClubListItem[] };

  return (
    <SearchClient
      initialQ={q}
      initialDate={date}
      initialPlayers={String(players)}
      initialSort={sort}
      clubs={data.clubs}
    />
  );
}
