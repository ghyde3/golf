"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { SlotRow, type TimesSlot as Slot } from "./SlotRow";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ClubProfile {
  id: string;
  name: string;
  slug: string;
  waitlistEnabled?: boolean;
  courses: { id: string; name: string; holes: number }[];
  config: {
    timezone: string;
    cancellationHours: number;
    bookingWindowDays: number;
  };
}

function formatTime(datetime: string, timezone: string): string {
  return new Date(datetime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function getDateChips(): { value: string; dayLabel: string; dayNum: number }[] {
  const chips = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = d.toISOString().split("T")[0];
    const dayLabel = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });
    chips.push({ value, dayLabel, dayNum: d.getDate() });
  }
  return chips;
}

function TimesPageInner({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const slotFullBanner = searchParams.get("error") === "slot_full";

  const [club, setClub] = useState<ClubProfile | null>(null);
  const [players, setPlayers] = useState(2);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/clubs/public/${params.slug}`)
      .then((r) => r.json())
      .then((data) => {
        setClub(data);
        if (data.courses?.length > 0 && !selectedCourse) {
          setSelectedCourse(data.courses[0].id);
        }
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  const fetchSlots = useCallback(async () => {
    if (!club?.id || !selectedCourse) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/clubs/${club.id}/availability?date=${selectedDate}&courseId=${selectedCourse}&players=1&full=1`
      );
      const data = await res.json();
      setAllSlots(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [club?.id, selectedCourse, selectedDate]);

  useEffect(() => {
    if (club?.id && selectedCourse) {
      fetchSlots();
    }
  }, [club?.id, selectedCourse, selectedDate, fetchSlots]);

  const filteredSlots = allSlots.filter((s) => s.maxPlayers - s.bookedPlayers >= players);

  const timezone = club?.config?.timezone || "America/New_York";

  const morningSlots = allSlots.filter((s) => {
    const h = new Date(s.datetime).toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    return parseInt(h, 10) < 12;
  });

  const afternoonSlots = allSlots.filter((s) => {
    const h = new Date(s.datetime).toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    return parseInt(h, 10) >= 12;
  });

  const soonestSlots = filteredSlots.slice(0, 5);

  const dateChips = getDateChips();

  function selectSlot(slot: Slot) {
    if (!isAvailable(slot)) return;
    const q = new URLSearchParams({
      clubId: club!.id,
      courseId: selectedCourse,
      datetime: slot.datetime,
      players: String(players),
      slotId: slot.id || "",
      price: slot.price ? String(slot.price) : "",
      slotType: slot.slotType,
    });
    router.push(`/book/${params.slug}/confirm?${q.toString()}`);
  }

  function isAvailable(slot: Slot) {
    return slot.maxPlayers - slot.bookedPlayers >= players;
  }

  return (
    <div className="flex min-h-screen flex-col bg-ds-warm-white lg:mx-auto lg:max-w-3xl lg:shadow-card">
      <header className="sticky top-0 z-20 shrink-0 border-b border-ds-stone bg-ds-warm-white">
        <div className="flex h-[52px] items-center gap-3 px-4">
          <Link href={`/book/${params.slug}`} className="flex items-center gap-1 text-[13px] font-medium text-ds-fairway">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-display text-base text-ds-ink">
            {club?.name ?? "Loading..."}
          </h1>
        </div>
        <div className="flex items-center border-t border-ds-stone px-4 py-2.5">
          <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-ds-muted">Players</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPlayers(Math.max(1, players - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-ds-stone bg-white text-base font-light text-ds-ink"
              aria-label="Decrease players"
            >
              −
            </button>
            <span className="min-w-[1.25rem] text-center font-display text-lg text-ds-ink">{players}</span>
            <button
              type="button"
              onClick={() => setPlayers(Math.min(4, players + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-ds-stone bg-white text-base font-light text-ds-ink"
              aria-label="Increase players"
            >
              +
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {slotFullBanner && (
          <div
            role="alert"
            className="mx-4 mt-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          >
            That slot just filled — please choose another time.
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto border-b border-ds-stone bg-ds-warm-white px-4 py-2.5 scrollbar-none">
          {dateChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setSelectedDate(chip.value)}
              className={`flex min-w-[52px] shrink-0 flex-col items-center rounded-xl border-[1.5px] px-3 py-2 transition-colors ${
                selectedDate === chip.value
                  ? "border-ds-forest bg-ds-forest"
                  : "border-ds-stone bg-white"
              }`}
            >
              <span
                className={`text-[9px] font-semibold uppercase tracking-wider ${
                  selectedDate === chip.value ? "text-white/60" : "text-ds-muted"
                }`}
              >
                {chip.dayLabel}
              </span>
              <span
                className={`font-display text-[17px] leading-tight ${
                  selectedDate === chip.value ? "text-white" : "text-ds-ink"
                }`}
              >
                {chip.dayNum}
              </span>
            </button>
          ))}
        </div>

        {club?.courses && club.courses.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-b border-ds-stone px-4 py-2.5 scrollbar-none">
            {club.courses.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => setSelectedCourse(course.id)}
                className={`shrink-0 rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-medium ${
                  selectedCourse === course.id
                    ? "border-ds-fairway bg-ds-fairway text-white"
                    : "border-ds-stone bg-white text-ds-muted"
                }`}
              >
                {course.name}
                <span className={`ml-1 text-[11px] ${selectedCourse === course.id ? "text-white/80" : "opacity-70"}`}>
                  ({course.holes}h)
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pb-8">
          {loading ? (
            <div className="py-16 text-center text-sm text-ds-muted">Loading tee times...</div>
          ) : (
            <>
              {soonestSlots.length > 0 && (
                <div className="border-b border-ds-stone bg-ds-cream px-4 py-3.5">
                  <div className="mb-2.5 flex flex-wrap items-baseline gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                      Soonest available
                    </span>
                    <span className="text-[11px] text-ds-muted">for {players} players</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-none">
                    {soonestSlots.map((slot) => (
                      <button
                        key={slot.datetime}
                        type="button"
                        onClick={() => selectSlot(slot)}
                        className="flex shrink-0 flex-col items-center gap-0.5 rounded-full bg-ds-fairway px-4 py-2 text-[13px] font-medium text-white"
                      >
                        <span>{formatTime(slot.datetime, timezone)}</span>
                        {slot.price != null && (
                          <span className="text-[10px] font-normal opacity-70">${slot.price}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {allSlots.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-lg text-ds-muted">No tee times available</p>
                  <p className="mt-1 text-sm text-ds-muted/80">Try a different date or course</p>
                </div>
              ) : (
                <>
                  {morningSlots.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 bg-ds-warm-white px-4 pb-1.5 pt-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ds-gold">
                          Morning
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-ds-stone to-transparent" />
                      </div>
                      <ul>
                        {morningSlots.map((slot) => (
                          <SlotRow
                            key={slot.datetime}
                            slot={slot}
                            available={isAvailable(slot)}
                            timezone={timezone}
                            onSelect={() => selectSlot(slot)}
                            clubSlug={params.slug}
                            waitlistEnabled={club?.waitlistEnabled === true}
                          />
                        ))}
                      </ul>
                    </section>
                  )}

                  {afternoonSlots.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 bg-ds-warm-white px-4 pb-1.5 pt-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ds-gold">
                          Afternoon
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-ds-stone to-transparent" />
                      </div>
                      <ul>
                        {afternoonSlots.map((slot) => (
                          <SlotRow
                            key={slot.datetime}
                            slot={slot}
                            available={isAvailable(slot)}
                            timezone={timezone}
                            onSelect={() => selectSlot(slot)}
                            clubSlug={params.slug}
                            waitlistEnabled={club?.waitlistEnabled === true}
                          />
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TimesPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ds-warm-white text-ds-muted">
          Loading…
        </div>
      }
    >
      <TimesPageInner params={params} />
    </Suspense>
  );
}
