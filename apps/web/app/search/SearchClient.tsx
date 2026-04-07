"use client";

import Link from "next/link";
import { PlacesAutocompleteInput } from "@/components/home/PlacesAutocompleteInput";
import { ClubCard } from "@/components/home/ClubCard";
import type { PublicClubListItem } from "@/components/home/types";

export function SearchClient({
  initialQ,
  initialDate,
  initialPlayers,
  initialSort,
  clubs,
}: {
  initialQ: string;
  initialDate: string;
  initialPlayers: string;
  initialSort?: string;
  clubs: PublicClubListItem[];
}) {
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
          <button
            type="submit"
            className="rounded-lg bg-ds-fairway px-6 py-2.5 text-sm font-semibold text-white lg:shrink-0"
          >
            Search
          </button>
        </form>

        <div className="mt-10">
          {clubs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ds-stone bg-white/60 px-6 py-16 text-center">
              <p className="font-display text-lg text-ds-ink">No courses found</p>
              <p className="mt-2 text-sm text-ds-muted">
                {initialQ
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
