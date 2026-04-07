"use client";

import Link from "next/link";
import { PlacesAutocompleteInput } from "./PlacesAutocompleteInput";

type Props = {
  defaultDate: string;
};

export function HomeSearchBar({ defaultDate }: Props) {
  return (
    <div className="relative z-[2] -mt-4 max-w-md px-4 lg:mx-auto lg:-mt-12 lg:max-w-[720px] lg:px-0">
      <Link
        href="/search"
        className="flex items-center gap-2.5 rounded-2xl border border-ds-stone bg-white p-3 pl-4 shadow-search lg:hidden"
      >
        <span className="text-ds-grass" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ds-ink">Find a course…</div>
          <div className="mt-0.5 text-[11px] text-ds-muted">Search by location, date & players</div>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ds-fairway">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" aria-hidden>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </Link>

      <form
        action="/search"
        method="get"
        className="hidden overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.2)] lg:flex lg:items-stretch"
      >
        <label className="flex min-w-0 flex-1 cursor-text flex-col border-r border-ds-stone px-4 py-[14px] lg:px-5 lg:py-[18px]">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Where</span>
          <PlacesAutocompleteInput
            name="q"
            placeholder="City, region, or area"
            className="w-full min-w-0 border-0 bg-transparent p-0 text-sm font-medium text-ds-ink outline-none placeholder:text-ds-muted"
          />
        </label>
        <label className="flex flex-1 flex-col border-r border-ds-stone px-4 py-[14px] lg:px-5 lg:py-[18px]">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">When</span>
          <input
            type="date"
            name="date"
            defaultValue={defaultDate}
            className="w-full border-0 bg-transparent p-0 text-sm font-medium text-ds-ink outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col px-4 py-[14px] lg:px-5 lg:py-[18px]">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Players</span>
          <input
            type="number"
            name="players"
            min={1}
            max={4}
            defaultValue={2}
            className="w-full border-0 bg-transparent p-0 text-sm font-medium text-ds-ink outline-none"
          />
        </label>
        <button
          type="submit"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap bg-ds-fairway px-6 text-sm font-semibold text-white"
        >
          Search
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}
