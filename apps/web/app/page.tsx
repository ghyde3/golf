import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { HomeSearchBar } from "@/components/home/HomeSearchBar";
import { ClubCard } from "@/components/home/ClubCard";
import { publicApiUrl } from "@/lib/public-api-url";
import type { PublicClubListItem } from "@/components/home/types";

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

type ClubProfile = {
  id: string;
  courses: { id: string }[];
  config: { timezone: string } | null;
};

type AvailSlot = {
  datetime: string;
  maxPlayers: number;
  bookedPlayers: number;
  status: string;
};

export default async function Home() {
  const session = await auth();
  const api = publicApiUrl();
  const today = new Date().toISOString().split("T")[0];

  const [featuredPayload, newPayload, tagCatalogPayload] = await Promise.all([
    getJson<{ clubs: PublicClubListItem[] }>(`${api}/api/clubs/public?limit=8`),
    getJson<{ clubs: PublicClubListItem[] }>(
      `${api}/api/clubs/public?limit=4&sort=new`
    ),
    getJson<{
      tags: {
        slug: string;
        label: string;
        groupName: string | null;
      }[];
    }>(`${api}/api/clubs/public/tags`),
  ]);

  const playGameChips: { label: string; href: string }[] = [
    {
      label: "18 holes",
      href: `/search?q=${encodeURIComponent("18 holes")}`,
    },
    {
      label: "9 holes",
      href: `/search?q=${encodeURIComponent("9 holes")}`,
    },
    ...(tagCatalogPayload?.tags ?? [])
      .filter((t) => t.groupName === "Course character")
      .map((t) => ({
        label: t.label,
        href: `/search?tag=${encodeURIComponent(t.slug)}`,
      })),
  ];

  const featured = featuredPayload?.clubs ?? [];
  const newlyAdded = newPayload?.clubs ?? [];
  const first = featured[0];

  let teaser: {
    slug: string;
    name: string;
    timezone: string;
    slots: { label: string; href: string }[];
  } | null = null;

  if (first) {
    const profile = await getJson<ClubProfile>(
      `${api}/api/clubs/public/${encodeURIComponent(first.slug)}`
    );
    const courseId = profile?.courses?.[0]?.id;
    const tz = profile?.config?.timezone ?? "America/New_York";
    if (profile?.id && courseId) {
      const avail = await getJson<AvailSlot[]>(
        `${api}/api/clubs/${profile.id}/availability?date=${encodeURIComponent(
          today
        )}&courseId=${encodeURIComponent(courseId)}&players=2&full=1`
      );
      if (avail?.length) {
        const bookable = avail.filter(
          (s) =>
            s.status !== "blocked" &&
            s.maxPlayers - s.bookedPlayers >= 2
        );
        teaser = {
          slug: first.slug,
          name: first.name,
          timezone: tz,
          slots: bookable.slice(0, 6).map((s) => ({
            label: new Date(s.datetime).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: tz,
            }),
            href: `/book/${first.slug}/times`,
          })),
        };
      }
    }
  }

  return (
    <main className="min-h-screen bg-ds-body-bg text-ds-ink antialiased">
      <header className="relative z-20 hidden h-16 items-center gap-10 border-b border-white/10 bg-ds-forest px-12 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl text-white">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-ds-gold text-sm font-bold text-ds-forest"
            aria-hidden
          >
            T
          </span>
          TeeTimes
        </Link>
        <nav className="flex flex-1 gap-7 text-[13px] font-medium">
          <span className="cursor-default text-white">Discover</span>
          <Link href="/search" className="text-white/80 transition hover:text-white">
            Search
          </Link>
          <span className="cursor-not-allowed text-white/55">Saved</span>
        </nav>
        <div className="flex items-center gap-5">
          {session?.user ? (
            <Link
              href="/account#bookings"
              className="text-[13px] font-medium text-white/80 transition hover:text-white"
            >
              My bookings
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] font-medium text-white/90 transition hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-ds-gold px-[18px] py-2 text-[13px] font-semibold text-ds-forest transition hover:bg-ds-gold-light"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="relative h-[340px] shrink-0 overflow-hidden bg-ds-forest lg:h-[min(580px,85vh)]">
        <Image
          src="/home-hero.png"
          alt=""
          fill
          priority
          className="object-cover object-[center_35%] lg:object-[center_30%]"
          sizes="100vw"
        />
        {/* Readability: darken left (headline) and bottom edge */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-ds-forest/95 via-ds-forest/55 to-ds-forest/20 lg:from-ds-forest/92 lg:via-ds-forest/45 lg:to-ds-forest/10"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-ds-forest/85 via-transparent to-ds-forest/30"
          aria-hidden
        />

        <div className="absolute inset-x-0 bottom-0 z-[1] px-6 pb-6 pt-8 lg:mx-auto lg:flex lg:max-w-[1320px] lg:items-end lg:px-12 lg:pb-[72px]">
          <div className="max-w-[680px]">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ds-gold-light lg:mb-4 lg:text-[11px] lg:tracking-[0.18em]">
              <span className="hidden items-center gap-2 lg:flex">
                <span className="h-px w-8 bg-ds-gold opacity-60" />
              </span>
              <span className="inline-flex h-1 w-1 rounded-full bg-ds-gold lg:hidden" />
              Tee Times
            </p>
            <h1 className="font-display text-[34px] font-bold leading-[1.15] tracking-tight text-white lg:text-[62px] lg:leading-[1.08]">
              Golf, booked
              <br />
              <span className="text-ds-gold-light lg:italic">in seconds.</span>
            </h1>
            <p className="mt-2 max-w-[440px] text-sm font-light text-white/60 lg:mt-4 lg:text-[17px] lg:leading-relaxed">
              Find your next round at courses near you
            </p>
          </div>
        </div>
      </section>

      {session?.user ? (
        <div className="border-b border-ds-stone/60 bg-ds-warm-white px-4 py-2.5 text-center lg:hidden">
          <Link href="/account#bookings" className="text-[12px] font-medium text-ds-fairway">
            My bookings
          </Link>
        </div>
      ) : (
        <div className="border-b border-ds-stone/60 bg-ds-warm-white px-4 py-2.5 lg:hidden">
          <div className="flex items-center justify-center gap-4">
            <Link href="/login" className="text-[13px] font-medium text-ds-ink">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-ds-gold px-4 py-2 text-[13px] font-semibold text-ds-forest"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}

      <HomeSearchBar defaultDate={today} />

      <section className="mx-auto max-w-[1320px] px-4 py-5 lg:px-12 lg:py-8">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold lg:tracking-[0.14em]">
          Play your game
        </p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:flex-wrap lg:gap-2.5 lg:px-0">
          {playGameChips.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="shrink-0 rounded-full border border-ds-stone bg-white px-3.5 py-1.5 text-[12px] font-medium text-ds-ink shadow-sm transition hover:border-ds-fairway hover:text-ds-fairway"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-4 py-6 lg:px-12 lg:py-10">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold lg:tracking-[0.14em]">
          Featured
        </p>
        <div className="mb-4 flex items-baseline justify-between lg:mb-6">
          <h2 className="font-display text-xl text-ds-ink lg:text-[26px]">Courses near you</h2>
          <Link
            href="/search"
            className="text-[13px] font-medium text-ds-fairway underline decoration-transparent lg:hover:decoration-ds-fairway"
          >
            See all
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="text-sm text-ds-muted">No courses available right now.</p>
        ) : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
            {featured.map((club, i) => (
              <ClubCard key={club.id} club={club} variant={i % 2 === 0 ? "a" : "b"} />
            ))}
          </div>
        )}

        <div className="relative mt-6 overflow-hidden rounded-2xl bg-ds-forest p-4 lg:mt-14 lg:flex lg:items-center lg:gap-8 lg:rounded-[20px] lg:p-8 lg:px-9">
          <div className="pointer-events-none absolute -right-5 -top-8 h-[140px] w-[140px] rounded-full border border-ds-grass/30 lg:right-auto lg:top-[-60px] lg:h-[300px] lg:w-[300px]" />
          <div className="pointer-events-none absolute right-2.5 top-0 h-20 w-20 rounded-full border border-ds-gold/20 lg:right-[60px] lg:bottom-[-80px] lg:top-auto lg:h-[200px] lg:w-[200px]" />
          <div className="relative z-[1] min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold-light lg:font-bold lg:tracking-[0.14em]">
              Available right now
            </p>
            <p className="font-display text-base text-white lg:text-[22px]">
              {teaser?.name ?? first?.name ?? "Find a tee time"}
            </p>
            <p className="mt-1 hidden text-[13px] text-white/50 lg:block">
              Jump into today&apos;s tee sheet
            </p>
          </div>
          <div className="relative z-[1] mt-3 flex flex-wrap gap-2 lg:mt-0 lg:gap-2.5">
            {teaser && teaser.slots.length > 0 ? (
              teaser.slots.map((s) => (
                <Link
                  key={s.label + s.href}
                  href={s.href}
                  className="rounded-full bg-ds-grass px-3.5 py-1.5 text-[13px] font-medium text-white lg:flex lg:flex-col lg:items-center lg:px-[18px] lg:py-2.5"
                >
                  <span>{s.label}</span>
                  <span className="hidden text-[10px] font-normal opacity-65 lg:inline">View times</span>
                </Link>
              ))
            ) : (
              <Link
                href={first ? `/book/${first.slug}/times` : "/search"}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-medium text-white"
              >
                Check availability →
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-4 py-6 lg:px-12 lg:pb-14">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold lg:tracking-[0.14em]">
          Newly added
        </p>
        <div className="mb-4 flex items-baseline justify-between lg:mb-6">
          <h2 className="font-display text-xl text-ds-ink lg:text-[26px]">Fresh on TeeTimes</h2>
          <Link href="/search?sort=new" className="text-[13px] font-medium text-ds-fairway">
            See all
          </Link>
        </div>
        {newlyAdded.length === 0 ? (
          <p className="text-sm text-ds-muted">No new clubs yet.</p>
        ) : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
            {newlyAdded.map((club, i) => (
              <ClubCard key={club.id} club={club} variant={i % 2 === 0 ? "b" : "a"} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[1320px] px-4 pb-10 lg:px-12">
        <div className="overflow-hidden rounded-2xl bg-ds-forest px-6 py-10 text-center lg:flex lg:items-center lg:justify-between lg:px-12 lg:text-left">
          <div>
            <p className="mb-2 font-display text-xl text-white lg:text-2xl">For golf clubs</p>
            <p className="max-w-xl text-sm text-white/60">
              Bring in more golfers with tee time booking built for operators.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 lg:mt-0 lg:flex-row">
            <Link
              href="/platform"
              className="rounded-lg bg-ds-gold px-6 py-3 text-sm font-semibold text-ds-forest"
            >
              Platform admin
            </Link>
            <Link
              href="/club"
              className="rounded-lg border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white"
            >
              Club console
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ds-stone bg-ds-warm-white">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
          <div>
            <p className="font-display text-lg text-ds-ink">TeeTimes</p>
            <p className="mt-2 text-sm text-ds-muted">Book golf in seconds.</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">Discover</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/" className="text-ds-fairway hover:underline">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-ds-fairway hover:underline">
                  Search
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">Operators</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/platform" className="text-ds-fairway hover:underline">
                  Platform admin
                </Link>
              </li>
              <li>
                <Link href="/club" className="text-ds-fairway hover:underline">
                  Club console
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">Company</p>
            <p className="mt-3 text-sm text-ds-muted">TeeTimes demo platform.</p>
          </div>
        </div>
        <div className="border-t border-ds-stone/80 py-4 text-center text-[12px] text-ds-muted">
          © {new Date().getFullYear()} TeeTimes
        </div>
      </footer>

      <nav className="sticky bottom-0 z-10 flex h-[60px] items-end border-t border-black/[0.07] bg-ds-warm-white pb-1 lg:hidden">
        <div className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium text-ds-fairway">
          <span className="h-5 w-5 rounded bg-ds-stone/30" aria-hidden />
          Discover
        </div>
        <Link
          href="/search"
          className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium text-ds-muted"
        >
          <span className="h-5 w-5 rounded bg-ds-stone/30" aria-hidden />
          Search
        </Link>
        <div className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium text-ds-muted">
          <span className="h-5 w-5 rounded bg-ds-stone/30" aria-hidden />
          Saved
        </div>
        <div className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium text-ds-muted">
          <span className="h-5 w-5 rounded bg-ds-stone/30" aria-hidden />
          Account
        </div>
      </nav>
    </main>
  );
}
