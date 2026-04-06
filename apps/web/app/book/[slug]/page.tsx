import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getClubProfile(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/clubs/public/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ClubProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const club = await getClubProfile(params.slug);
  const displayName =
    club?.name ??
    params.slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  const courseCount = club?.courses?.length ?? 0;
  const bookHref = `/book/${params.slug}/times${club ? `?clubId=${club.id}` : ""}`;

  return (
    <div className="bg-ds-warm-white pb-8 lg:pb-0">
      {/* Hero */}
      <section className="relative h-[260px] shrink-0 overflow-hidden bg-ds-forest lg:h-[440px]">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_30%_50%,rgba(74,140,92,0.5)_0%,transparent_60%),radial-gradient(ellipse_60%_60%_at_80%_30%,rgba(201,168,76,0.2)_0%,transparent_50%),linear-gradient(160deg,#1a3a2a_0%,#2d5a3d_60%,#1a3a2a_100%)]"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(74,140,92,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(74,140,92,0.12) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            transform: "perspective(300px) rotateX(20deg)",
            transformOrigin: "bottom center",
          }}
        />
        <div
          className="absolute inset-0 hidden opacity-50 lg:block"
          style={{
            backgroundImage:
              "linear-gradient(rgba(74,140,92,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(74,140,92,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            transform: "perspective(500px) rotateX(15deg)",
            transformOrigin: "bottom center",
          }}
        />
        <div className="absolute inset-0 hidden lg:block">
          <div className="absolute -right-[50px] -top-[150px] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(74,140,92,0.3)_0%,transparent_70%)]" />
          <div className="absolute bottom-[-50px] left-[300px] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.15)_0%,transparent_70%)]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent lg:bg-gradient-to-b lg:from-ds-forest/20 lg:to-ds-forest/75" />

        <Link
          href="/"
          className="absolute left-4 top-4 z-[2] flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-md lg:left-12 lg:top-8"
          aria-label="Back to home"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </Link>

        <div className="absolute inset-x-0 bottom-0 z-[1] px-5 pb-5 lg:mx-auto lg:flex lg:max-w-[1320px] lg:items-end lg:justify-between lg:px-12 lg:pb-10">
          <div className="max-w-2xl">
            {courseCount > 0 && (
              <p className="mb-2 inline-flex items-center gap-1 rounded-full border border-ds-gold/40 bg-ds-gold/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-ds-gold-light">
                <span className="h-1 w-1 rounded-full bg-ds-gold-light" aria-hidden />
                {courseCount} course{courseCount !== 1 ? "s" : ""} available
              </p>
            )}
            <h1 className="font-display text-[26px] font-bold leading-tight text-white lg:text-[52px] lg:leading-[1.08]">
              {(() => {
                const parts = displayName.split(" ");
                if (parts.length <= 1) return displayName;
                return (
                  <>
                    {parts[0]}
                    <br />
                    {parts.slice(1).join(" ")}
                  </>
                );
              })()}
            </h1>
            <p className="mt-1 text-[13px] text-white/60 lg:text-base lg:font-light lg:text-white/55">
              Golf club
            </p>
          </div>

          <div className="mt-6 hidden gap-5 lg:flex lg:pb-1">
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-white">{courseCount || "—"}</div>
              <div className="text-[11px] text-white/55">Courses</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-white">18</div>
              <div className="text-[11px] text-white/55">Holes</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-white">
                {club?.config?.openTime?.slice(0, 5) ?? "—"}
              </div>
              <div className="text-[11px] text-white/55">Opens</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip — mobile */}
      <div className="flex border-b border-ds-stone bg-white lg:hidden">
        {[
          { val: String(courseCount || "—"), lbl: "Courses" },
          { val: "18", lbl: "Holes" },
          { val: club?.config?.openTime?.slice(0, 5) ?? "—", lbl: "Opens" },
          { val: club?.config?.closeTime?.slice(0, 5) ?? "—", lbl: "Closes" },
        ].map((s) => (
          <div
            key={s.lbl}
            className="flex-1 border-r border-ds-stone py-3.5 text-center last:border-r-0"
          >
            <div className="font-display text-lg font-bold text-ds-fairway">{s.val}</div>
            <div className="mt-0.5 text-[10px] tracking-wide text-ds-muted">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Book section — decorative soonest + CTA to times */}
      <div className="border-b border-ds-stone bg-ds-cream px-4 py-4 lg:hidden">
        <div className="mb-3.5 flex items-center">
          <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-ds-muted">
            Get started
          </span>
        </div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-ds-gold">
          Book a tee time
        </p>
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          <Link
            href={bookHref}
            className="shrink-0 rounded-full bg-ds-fairway px-4 py-2 text-[13px] font-medium text-white"
          >
            Choose a time →
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[720px] px-5 pt-5 lg:mx-auto lg:max-w-[1320px] lg:px-12 lg:pt-12">
        {club?.description && (
          <section className="mb-6">
            <h2 className="font-display text-base text-ds-ink lg:text-lg">About</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ds-muted lg:text-sm">{club.description}</p>
          </section>
        )}

        <section className="mb-6">
          <h2 className="font-display text-base text-ds-ink lg:text-lg">Courses</h2>
          {club?.courses && club.courses.length > 0 ? (
            <ul className="mt-3">
              {club.courses.map(
                (course: { id: string; name: string; holes: number }, i: number) => (
                  <li
                    key={course.id}
                    className="flex items-center border-b border-ds-stone py-3 last:border-b-0"
                  >
                    <span
                      className={`mr-3 h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-ds-stone" : "bg-ds-grass"}`}
                      aria-hidden
                    />
                    <span className="flex-1 text-sm font-medium text-ds-ink">{course.name}</span>
                    <span className="mr-2 text-xs text-ds-muted">{course.holes}h</span>
                    <span className="text-ds-muted">›</span>
                  </li>
                )
              )}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ds-muted">No courses configured yet. Check back soon!</p>
          )}
        </section>

        <section className="mb-2">
          <h2 className="font-display text-base text-ds-ink lg:text-lg">Hours</h2>
          <div className="mt-3 text-[13px]">
            <div className="flex justify-between border-b border-ds-stone py-2 first:pt-0">
              <span className="text-ds-muted">Default</span>
              <span className="font-medium text-ds-ink">
                {club?.config?.openTime?.slice(0, 5) ?? "06:00"} –{" "}
                {club?.config?.closeTime?.slice(0, 5) ?? "18:00"}
              </span>
            </div>
            {club?.config?.schedule?.map(
              (s: { dayOfWeek: number; openTime: string; closeTime: string }) => (
                <div key={s.dayOfWeek} className="flex justify-between border-b border-ds-stone py-2 last:border-b-0">
                  <span className="text-ds-muted">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.dayOfWeek]}
                  </span>
                  <span className="font-medium text-ds-ink">
                    {s.openTime} – {s.closeTime}
                  </span>
                </div>
              )
            )}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 bg-ds-warm-white px-5 pb-5 pt-4 lg:static lg:mx-auto lg:max-w-[1320px] lg:bg-transparent lg:px-12 lg:pb-12 lg:pt-6">
        <Link
          href={bookHref}
          className="relative block w-full overflow-hidden rounded-[14px] bg-ds-fairway py-4 text-center text-[15px] font-semibold tracking-wide text-white shadow-card after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/10 after:to-transparent after:pointer-events-none"
        >
          Book a Tee Time
        </Link>
      </div>
    </div>
  );
}
