import Link from "next/link";
import type { PublicClubListItem } from "./types";
import { ClubCardIllustration } from "./ClubCardIllustration";

function truncate(s: string | null, max: number): string {
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export function ClubCard({
  club,
  variant = "a",
}: {
  club: PublicClubListItem;
  variant?: "a" | "b";
}) {
  const loc =
    club.city && club.state
      ? `${club.city}, ${club.state}`
      : club.city || club.state || "";
  const subtitle = loc || truncate(club.description, 48);

  return (
    <Link
      href={`/book/${club.slug}`}
      className="w-[220px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-card lg:w-auto lg:border lg:border-ds-stone lg:shadow-none lg:transition lg:hover:-translate-y-1 lg:hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)]"
    >
      <div className="relative h-[130px] overflow-hidden lg:h-40">
        {club.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external club URLs; avoid remotePatterns config
          <img
            src={club.heroImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <ClubCardIllustration variant={variant} />
        )}
      </div>
      <div className="px-3.5 pb-3.5 pt-3 lg:p-4">
        <div className="font-display text-[15px] font-bold text-ds-ink lg:text-base">
          {club.name}
        </div>
        <div className="mb-2 text-[11px] text-ds-muted lg:mb-3 lg:text-xs">{subtitle}</div>
        <div className="flex flex-wrap items-center gap-2">
          {club.maxHoles > 0 && (
            <span className="rounded-full bg-ds-tag-green px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ds-fairway">
              {club.maxHoles} holes
            </span>
          )}
          <span className="rounded-full bg-ds-tag-gold-bg px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ds-tag-gold-fg">
            Book now
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-ds-grass">
            <span className="avail-dot inline-block h-1.5 w-1.5 rounded-full bg-ds-grass" />
            Open
          </span>
        </div>
      </div>
    </Link>
  );
}
