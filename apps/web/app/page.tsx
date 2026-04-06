import Link from "next/link";

const FEATURED_SLUG = "pinebrook";

function ClubCardIllustration({ variant }: { variant: "a" | "b" }) {
  if (variant === "a") {
    return (
      <svg
        className="h-full w-full"
        viewBox="0 0 220 130"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="220" height="130" fill="#1a3a2a" />
        <ellipse cx="110" cy="80" rx="120" ry="60" fill="#2d5a3d" opacity={0.8} />
        <ellipse cx="160" cy="40" rx="60" ry="40" fill="#4a8c5c" opacity={0.5} />
        <rect x="0" y="100" width="220" height="30" fill="#1a3a2a" opacity={0.6} />
        <circle cx="50" cy="50" r="20" fill="#4a8c5c" opacity={0.3} />
      </svg>
    );
  }
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 220 130"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="220" height="130" fill="#2d4a1a" />
      <ellipse cx="80" cy="90" rx="130" ry="50" fill="#4a7a2d" opacity={0.7} />
      <ellipse cx="180" cy="30" rx="70" ry="50" fill="#6a9a3d" opacity={0.4} />
      <circle cx="170" cy="70" r="25" fill="#3a6a1a" opacity={0.4} />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-ds-body-bg text-ds-ink antialiased">
      {/* Desktop top nav */}
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
          <span className="cursor-not-allowed text-white/55">Search</span>
          <span className="cursor-not-allowed text-white/55">Saved</span>
        </nav>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/10 px-[18px] py-2 text-[13px] font-semibold text-white"
            disabled
          >
            Sign in
          </button>
          <Link
            href={`/book/${FEATURED_SLUG}`}
            className="rounded-lg bg-ds-gold px-[18px] py-2 text-[13px] font-semibold text-ds-forest"
          >
            Book now
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative h-[340px] shrink-0 overflow-hidden bg-ds-forest lg:h-[min(580px,85vh)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_40%,rgba(74,140,92,0.4)_0%,transparent_70%),linear-gradient(180deg,rgba(26,58,42,0.3)_0%,rgba(26,58,42,0.95)_85%)] lg:bg-[linear-gradient(90deg,rgba(26,58,42,0.85)_0%,rgba(26,58,42,0.3)_60%,transparent_100%)]" />
        <div
          className="absolute inset-0 hidden opacity-40 lg:block"
          style={{
            backgroundImage:
              "linear-gradient(rgba(74,140,92,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(74,140,92,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            transform: "perspective(500px) rotateX(18deg)",
            transformOrigin: "bottom center",
          }}
        />
        <div className="absolute inset-0 lg:hidden">
          <div className="absolute -left-[100px] -top-[100px] h-[600px] w-[600px] rounded-full border border-ds-grass/20" />
          <div className="absolute left-[50px] top-[50px] h-[400px] w-[400px] rounded-full border border-ds-grass/20" />
          <div className="absolute left-[150px] top-[150px] h-[200px] w-[200px] rounded-full border border-ds-grass/20" />
          <div className="absolute -bottom-[50px] -right-[200px] h-[300px] w-[800px] rounded-full border border-ds-gold/15" />
        </div>
        <div className="absolute inset-0 hidden lg:block">
          <div className="absolute -right-[100px] -top-[200px] h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(74,140,92,0.25)_0%,transparent_70%)]" />
          <div className="absolute bottom-[-100px] left-[200px] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(45,90,61,0.4)_0%,transparent_70%)]" />
          <div className="absolute left-[100px] top-[100px] h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.15)_0%,transparent_70%)]" />
        </div>

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

      {/* Search — mobile card; desktop segmented bar */}
      <div className="relative z-[2] -mt-4 max-w-md px-4 lg:mx-auto lg:-mt-12 lg:max-w-[580px] lg:px-0">
        <Link
          href={`/book/${FEATURED_SLUG}`}
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
            <div className="mt-0.5 text-[11px] text-ds-muted">Today · 2 players · Near me</div>
          </div>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ds-fairway">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" aria-hidden>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </Link>

        <div className="hidden overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.2)] lg:flex">
          <div className="flex flex-1 cursor-pointer flex-col border-r border-ds-stone px-5 py-[18px]">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Where</div>
            <div className="text-sm font-medium text-ds-ink">Near me</div>
          </div>
          <div className="flex flex-1 cursor-pointer flex-col border-r border-ds-stone px-5 py-[18px]">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">When</div>
            <div className="text-sm font-medium text-ds-ink">Today</div>
          </div>
          <div className="flex flex-1 cursor-pointer flex-col px-5 py-[18px]">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Players</div>
            <div className="text-sm font-medium text-ds-ink">2</div>
          </div>
          <Link
            href={`/book/${FEATURED_SLUG}`}
            className="flex items-center gap-2 whitespace-nowrap bg-ds-fairway px-6 text-sm font-semibold text-white"
          >
            Search
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Featured courses */}
      <section className="mx-auto max-w-[1320px] px-4 py-6 lg:px-12 lg:py-14">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold lg:tracking-[0.14em]">
          Featured
        </p>
        <div className="mb-4 flex items-baseline justify-between lg:mb-6">
          <h2 className="font-display text-xl text-ds-ink lg:text-[26px]">Courses near you</h2>
          <span className="text-[13px] font-medium text-ds-fairway underline decoration-transparent lg:hover:decoration-ds-fairway">
            See all
          </span>
        </div>

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
          <Link
            href={`/book/${FEATURED_SLUG}`}
            className="w-[220px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-card lg:w-auto lg:border lg:border-ds-stone lg:shadow-none lg:transition lg:hover:-translate-y-1 lg:hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)]"
          >
            <div className="relative h-[130px] overflow-hidden lg:h-40">
              <ClubCardIllustration variant="a" />
            </div>
            <div className="px-3.5 pb-3.5 pt-3 lg:p-4">
              <div className="font-display text-[15px] font-bold text-ds-ink lg:text-base">Pinebrook GC</div>
              <div className="mb-2 text-[11px] text-ds-muted lg:mb-3 lg:text-xs">Ridgewood, NJ · Demo</div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-ds-tag-green px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ds-fairway">
                  18 holes
                </span>
                <span className="rounded-full bg-ds-tag-gold-bg px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ds-tag-gold-fg">
                  Book now
                </span>
              </div>
            </div>
          </Link>

          <div className="hidden w-[220px] shrink-0 overflow-hidden rounded-2xl border border-ds-stone bg-white opacity-90 lg:block lg:w-auto">
            <div className="relative h-40 overflow-hidden">
              <ClubCardIllustration variant="b" />
            </div>
            <div className="p-4">
              <div className="font-display text-base text-ds-ink">Oak Valley CC</div>
              <div className="mb-3 text-xs text-ds-muted">Coming soon</div>
              <div className="flex gap-2">
                <span className="rounded-full bg-ds-tag-green px-2 py-0.5 text-[10px] font-semibold text-ds-fairway">
                  18 holes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Times teaser */}
        <div className="relative mt-6 overflow-hidden rounded-2xl bg-ds-forest p-4 lg:mt-14 lg:flex lg:items-center lg:gap-8 lg:rounded-[20px] lg:p-8 lg:px-9">
          <div className="pointer-events-none absolute -right-5 -top-8 h-[140px] w-[140px] rounded-full border border-ds-grass/30 lg:right-auto lg:top-[-60px] lg:h-[300px] lg:w-[300px]" />
          <div className="pointer-events-none absolute right-2.5 top-0 h-20 w-20 rounded-full border border-ds-gold/20 lg:right-[60px] lg:bottom-[-80px] lg:top-auto lg:h-[200px] lg:w-[200px]" />
          <div className="relative z-[1] min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold-light lg:font-bold lg:tracking-[0.14em]">
              Available right now
            </p>
            <p className="font-display text-base text-white lg:text-[22px]">Pinebrook Golf Club</p>
            <p className="mt-1 hidden text-[13px] text-white/50 lg:block">Jump into today&apos;s tee sheet</p>
          </div>
          <div className="relative z-[1] mt-3 flex flex-wrap gap-2 lg:mt-0 lg:gap-2.5">
            {["6:20 AM", "6:40 AM", "7:00 AM"].map((t) => (
              <Link
                key={t}
                href={`/book/${FEATURED_SLUG}/times`}
                className="rounded-full bg-ds-grass px-3.5 py-1.5 text-[13px] font-medium text-white lg:flex lg:flex-col lg:items-center lg:px-[18px] lg:py-2.5"
              >
                <span>{t}</span>
                <span className="hidden text-[10px] font-normal opacity-65 lg:inline">View times</span>
              </Link>
            ))}
            <Link
              href={`/book/${FEATURED_SLUG}/times`}
              className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white lg:px-[18px] lg:py-2.5"
            >
              12:00 PM
            </Link>
            <Link
              href={`/book/${FEATURED_SLUG}/times`}
              className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white lg:px-[18px] lg:py-2.5"
            >
              3:10 PM
            </Link>
          </div>
        </div>
      </section>

      {/* Operators */}
      <section className="mx-auto max-w-md border-t border-ds-stone px-4 py-10 lg:max-w-[1320px] lg:px-12">
        <p className="mb-3 text-center text-sm font-medium text-ds-muted lg:text-left">Operators</p>
        <div className="flex flex-col gap-2 text-center lg:flex-row lg:justify-center lg:gap-8">
          <Link href="/platform" className="text-sm font-medium text-ds-fairway underline-offset-4 hover:underline">
            Platform admin
          </Link>
          <Link href="/club" className="text-sm font-medium text-ds-fairway underline-offset-4 hover:underline">
            Club console
          </Link>
        </div>
      </section>

      {/* Mobile bottom nav (visual parity with reference) */}
      <nav className="sticky bottom-0 z-10 flex h-[60px] items-end border-t border-black/[0.07] bg-ds-warm-white pb-1 lg:hidden">
        {[
          { label: "Discover", active: true },
          { label: "Search", active: false },
          { label: "Saved", active: false },
          { label: "Account", active: false },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium ${
              item.active ? "text-ds-fairway" : "text-ds-muted"
            }`}
          >
            <span className="h-5 w-5 rounded bg-ds-stone/30" aria-hidden />
            {item.label}
          </div>
        ))}
      </nav>
    </main>
  );
}
