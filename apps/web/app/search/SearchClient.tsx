"use client";

import Link from "next/link";
import { PlacesAutocompleteInput } from "@/components/home/PlacesAutocompleteInput";
import { ClubCard } from "@/components/home/ClubCard";
import type { PublicClubListItem } from "@/components/home/types";
import { isHoleLayoutQuery } from "@/lib/search-query-context";
import type { PublicTagCatalogItem } from "./types";

function buildSearchUrl(opts: {
  q?: string;
  tag?: string;
  date: string;
  players: string;
  sort?: string;
}): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.tag) p.set("tag", opts.tag);
  p.set("date", opts.date);
  p.set("players", opts.players);
  if (opts.sort === "new") p.set("sort", "new");
  return `/search?${p.toString()}`;
}

function groupTagsByGroupName(tags: PublicTagCatalogItem[]): Map<string, PublicTagCatalogItem[]> {
  const m = new Map<string, PublicTagCatalogItem[]>();
  const order = ["Course character", "Amenities", "Experience", "Other"];
  for (const t of tags) {
    const g = t.groupName ?? "Other";
    const list = m.get(g) ?? [];
    list.push(t);
    m.set(g, list);
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
  }
  const sorted = new Map<string, PublicTagCatalogItem[]>();
  for (const key of order) {
    if (m.has(key)) sorted.set(key, m.get(key)!);
  }
  for (const [k, v] of m) {
    if (!sorted.has(k)) sorted.set(k, v);
  }
  return sorted;
}

export function SearchClient({
  initialQ,
  initialTag,
  initialTagLabel,
  tagCatalog,
  initialDate,
  initialPlayers,
  initialSort,
  clubs,
}: {
  initialQ: string;
  initialTag: string;
  initialTagLabel: string;
  tagCatalog: PublicTagCatalogItem[];
  initialDate: string;
  initialPlayers: string;
  initialSort?: string;
  clubs: PublicClubListItem[];
}) {
  const base = {
    date: initialDate,
    players: initialPlayers,
    sort: initialSort,
  };

  const clearTagHref = buildSearchUrl({ ...base, q: initialQ || undefined });
  const layoutNineHref = buildSearchUrl({
    ...base,
    q: "9 holes",
    tag: initialTag || undefined,
  });
  const layoutEighteenHref = buildSearchUrl({
    ...base,
    q: "18 holes",
    tag: initialTag || undefined,
  });

  const qIsNine = /^\s*9\s*holes?\s*$/i.test(initialQ.trim());
  const qIsEighteen = /^\s*18\s*holes?\s*$/i.test(initialQ.trim());

  const tagGroups = groupTagsByGroupName(tagCatalog);

  return (
    <main className="min-h-screen bg-ds-body-bg text-ds-ink antialiased">
      <header className="border-b border-ds-stone bg-ds-forest px-4 py-4 lg:px-12">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-display text-lg text-white">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-ds-gold text-sm font-bold text-ds-forest"
              aria-hidden
            >
              T
            </span>
            TeeTimes
          </Link>
          <Link href="/" className="text-[13px] font-medium text-white/80 hover:text-white">
            ← Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-4 py-6 lg:px-12 lg:py-10">
        <h1 className="font-display text-2xl text-ds-ink lg:text-3xl">Search courses</h1>
        <p className="mt-2 text-sm text-ds-muted">Find tee times by location, date, and group size.</p>

        <form
          action="/search"
          method="get"
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-ds-stone bg-white p-4 shadow-card lg:flex-row lg:items-end lg:gap-4"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Where</span>
            <PlacesAutocompleteInput
              name="q"
              defaultValue={initialQ}
              placeholder="City, region, or area"
              className="rounded-lg border border-ds-stone px-3 py-2 text-sm outline-none focus:border-ds-fairway"
            />
          </label>
          <label className="flex flex-col gap-1 lg:w-44">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">When</span>
            <input
              type="date"
              name="date"
              defaultValue={initialDate}
              className="rounded-lg border border-ds-stone px-3 py-2 text-sm outline-none focus:border-ds-fairway"
            />
          </label>
          <label className="flex flex-col gap-1 lg:w-28">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Players</span>
            <input
              type="number"
              name="players"
              min={1}
              max={4}
              defaultValue={initialPlayers}
              className="rounded-lg border border-ds-stone px-3 py-2 text-sm outline-none focus:border-ds-fairway"
            />
          </label>
          {initialSort === "new" ? <input type="hidden" name="sort" value="new" /> : null}
          {initialTag ? <input type="hidden" name="tag" value={initialTag} /> : null}
          <button
            type="submit"
            className="rounded-lg bg-ds-fairway px-6 py-2.5 text-sm font-semibold text-white lg:shrink-0"
          >
            Search
          </button>
        </form>

        <section className="mt-6 rounded-2xl border border-ds-stone bg-white p-4 shadow-card">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Filters</h2>

          {initialTag ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ds-muted">Filter:</span>
              <span className="rounded-full border border-ds-fairway/40 bg-ds-fairway/10 px-3 py-1 font-medium text-ds-ink">
                {initialTagLabel || initialTag}
              </span>
              <Link
                href={clearTagHref}
                className="text-xs font-medium text-ds-fairway underline underline-offset-2"
              >
                Clear tag
              </Link>
            </div>
          ) : null}

          <div className={initialTag ? "mt-5" : "mt-3"}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Layout</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={layoutNineHref}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium shadow-sm transition ${
                  qIsNine
                    ? "border-ds-fairway bg-ds-fairway/10 text-ds-fairway"
                    : "border-ds-stone bg-white text-ds-ink hover:border-ds-fairway hover:text-ds-fairway"
                }`}
              >
                9 holes
              </Link>
              <Link
                href={layoutEighteenHref}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium shadow-sm transition ${
                  qIsEighteen
                    ? "border-ds-fairway bg-ds-fairway/10 text-ds-fairway"
                    : "border-ds-stone bg-white text-ds-ink hover:border-ds-fairway hover:text-ds-fairway"
                }`}
              >
                18 holes
              </Link>
              {initialQ && isHoleLayoutQuery(initialQ) ? (
                <Link
                  href={buildSearchUrl({
                    ...base,
                    q: undefined,
                    tag: initialTag || undefined,
                  })}
                  className="text-[12px] font-medium text-ds-muted underline underline-offset-2"
                >
                  Clear layout
                </Link>
              ) : null}
            </div>
          </div>

          {tagCatalog.length > 0 ? (
            <div className="mt-5 space-y-4">
              {[...tagGroups.entries()].map(([groupName, tags]) => (
                <div key={groupName}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
                    {groupName}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => {
                      const active = initialTag === t.slug;
                      const href = buildSearchUrl({
                        ...base,
                        q: initialQ || undefined,
                        tag: t.slug,
                      });
                      return (
                        <Link
                          key={t.slug}
                          href={href}
                          className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium shadow-sm transition ${
                            active
                              ? "border-ds-fairway bg-ds-fairway/10 text-ds-fairway"
                              : "border-ds-stone bg-white text-ds-ink hover:border-ds-fairway hover:text-ds-fairway"
                          }`}
                        >
                          {t.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <div className="mt-10">
          {clubs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ds-stone bg-white/60 px-6 py-16 text-center">
              <p className="font-display text-lg text-ds-ink">No courses found</p>
              <p className="mt-2 text-sm text-ds-muted">
                {initialTag && !initialQ
                  ? `No courses with this tag right now. Try another filter or clear the tag.`
                  : initialQ
                    ? `Try a different search for “${initialQ}”.`
                    : "Try adjusting your search or browse from the home page."}
              </p>
              <Link href="/" className="mt-4 inline-block text-sm font-medium text-ds-fairway underline">
                Back to Discover
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {clubs.map((club, i) => (
                <ClubCard key={club.id} club={club} variant={i % 2 === 0 ? "a" : "b"} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
