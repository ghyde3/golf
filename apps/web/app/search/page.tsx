import { SearchClient } from "./SearchClient";
import { publicApiUrl } from "@/lib/public-api-url";
import type { PublicClubListItem } from "@/components/home/types";
import type { PublicTagCatalogItem } from "./types";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    date?: string;
    players?: string;
    sort?: string;
    tag?: string;
  };
}) {
  const sp = searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tag = typeof sp.tag === "string" ? sp.tag.trim() : "";
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
  if (tag) url.searchParams.set("tag", tag);
  if (sort) url.searchParams.set("sort", sort);
  url.searchParams.set("limit", "20");

  const [catalogRes, clubsRes] = await Promise.all([
    fetch(`${api}/api/clubs/public/tags`, { cache: "no-store" }),
    fetch(url.toString(), { cache: "no-store" }),
  ]);

  const catalogPayload = catalogRes.ok
    ? ((await catalogRes.json()) as { tags: PublicTagCatalogItem[] })
    : { tags: [] as PublicTagCatalogItem[] };
  const tagCatalog = catalogPayload.tags ?? [];

  let tagLabel = "";
  if (tag) {
    tagLabel = tagCatalog.find((t) => t.slug === tag)?.label ?? tag;
  }

  const data = clubsRes.ok
    ? ((await clubsRes.json()) as { clubs: PublicClubListItem[] })
    : { clubs: [] as PublicClubListItem[] };

  return (
    <SearchClient
      initialQ={q}
      initialTag={tag}
      initialTagLabel={tagLabel}
      tagCatalog={tagCatalog}
      initialDate={date}
      initialPlayers={String(players)}
      initialSort={sort}
      clubs={data.clubs}
    />
  );
}
