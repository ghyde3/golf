"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Slot {
  id: string | null;
  datetime: string;
  maxPlayers: number;
  bookedPlayers: number;
  status: string;
  price: number | null;
  slotType: string;
}

interface ClubProfile {
  id: string;
  name: string;
  slug: string;
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

function getDateChips(): { label: string; value: string; dayLabel: string }[] {
  const chips = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = d.toISOString().split("T")[0];
    const dayLabel = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    chips.push({ label, value, dayLabel });
  }
  return chips;
}

function TimesPageInner({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clubIdParam = searchParams.get("clubId");
  const slotFullBanner = searchParams.get("error") === "slot_full";

  const [club, setClub] = useState<ClubProfile | null>(null);
  const [players, setPlayers] = useState(2);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
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

  const filteredSlots = allSlots.filter(
    (s) => s.maxPlayers - s.bookedPlayers >= players
  );

  const timezone = club?.config?.timezone || "America/New_York";

  const morningSlots = allSlots.filter((s) => {
    const h = new Date(s.datetime).toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    return parseInt(h) < 12;
  });

  const afternoonSlots = allSlots.filter((s) => {
    const h = new Date(s.datetime).toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    return parseInt(h) >= 12;
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
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <a
            href={`/book/${params.slug}`}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Back
          </a>
          <h1 className="font-semibold text-gray-800 truncate">
            {club?.name ?? "Loading..."}
          </h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {slotFullBanner && (
          <div
            role="alert"
            className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2"
          >
            That slot just filled — please choose another time.
          </div>
        )}
        {/* Players selector */}
        <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
          <span className="text-sm font-medium text-gray-700">Players</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlayers(Math.max(1, players - 1))}
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200"
            >
              −
            </button>
            <span className="text-lg font-semibold w-6 text-center">
              {players}
            </span>
            <button
              onClick={() => setPlayers(Math.min(4, players + 1))}
              className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center hover:bg-green-200"
            >
              +
            </button>
          </div>
        </div>

        {/* Date bar */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dateChips.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setSelectedDate(chip.value)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-center min-w-[4.5rem] ${
                selectedDate === chip.value
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <div className="text-xs font-medium">{chip.dayLabel}</div>
              <div className="text-sm">{chip.label}</div>
            </button>
          ))}
        </div>

        {/* Course selector */}
        {club?.courses && club.courses.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {club.courses.map((course) => (
              <button
                key={course.id}
                onClick={() => setSelectedCourse(course.id)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm ${
                  selectedCourse === course.id
                    ? "bg-green-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {course.name}
                <span className="ml-1 text-xs opacity-70">
                  ({course.holes}h)
                </span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">
            Loading tee times...
          </div>
        ) : (
          <>
            {/* Soonest available pills */}
            {soonestSlots.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-2">
                  Soonest Available
                </h2>
                <div className="flex gap-2 overflow-x-auto">
                  {soonestSlots.map((slot) => (
                    <button
                      key={slot.datetime}
                      onClick={() => selectSlot(slot)}
                      className="flex-shrink-0 px-4 py-2 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700"
                    >
                      {formatTime(slot.datetime, timezone)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allSlots.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No tee times available</p>
                <p className="text-gray-400 text-sm mt-1">
                  Try a different date or course
                </p>
              </div>
            ) : (
              <>
                {/* Morning slots */}
                {morningSlots.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-600 mb-2">
                      Morning
                    </h2>
                    <div className="space-y-1">
                      {morningSlots.map((slot) => (
                        <SlotRow
                          key={slot.datetime}
                          slot={slot}
                          available={isAvailable(slot)}
                          timezone={timezone}
                          onSelect={() => selectSlot(slot)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Afternoon slots */}
                {afternoonSlots.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-600 mb-2">
                      Afternoon
                    </h2>
                    <div className="space-y-1">
                      {afternoonSlots.map((slot) => (
                        <SlotRow
                          key={slot.datetime}
                          slot={slot}
                          available={isAvailable(slot)}
                          timezone={timezone}
                          onSelect={() => selectSlot(slot)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function TimesPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
          Loading…
        </main>
      }
    >
      <TimesPageInner params={params} />
    </Suspense>
  );
}

function SlotRow({
  slot,
  available,
  timezone,
  onSelect,
}: {
  slot: Slot;
  available: boolean;
  timezone: string;
  onSelect: () => void;
}) {
  const spots = slot.maxPlayers - slot.bookedPlayers;
  return (
    <button
      onClick={available ? onSelect : undefined}
      disabled={!available}
      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
        available
          ? "bg-white hover:bg-green-50 cursor-pointer"
          : "bg-gray-100 opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`font-medium ${available ? "text-gray-800" : "text-gray-400"}`}>
          {formatTime(slot.datetime, timezone)}
        </span>
        <div className="flex gap-0.5">
          {Array.from({ length: slot.maxPlayers }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < slot.bookedPlayers ? "bg-gray-300" : "bg-green-500"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="text-right">
        <span className={`text-sm ${available ? "text-gray-600" : "text-gray-400"}`}>
          {available ? `${spots} spot${spots !== 1 ? "s" : ""}` : "Full"}
        </span>
        {slot.price && (
          <span className="text-sm text-gray-500 ml-2">${slot.price}</span>
        )}
      </div>
    </button>
  );
}
