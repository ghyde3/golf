"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ClubProfile {
  id: string;
  name: string;
  slug: string;
  config: {
    timezone: string;
    cancellationHours: number;
  };
}

export default function ConfirmPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const clubId = searchParams.get("clubId") || "";
  const courseId = searchParams.get("courseId") || "";
  const datetime = searchParams.get("datetime") || "";
  const playersParam = searchParams.get("players") || "2";
  const slotId = searchParams.get("slotId") || "";
  const slotType = searchParams.get("slotType") || "18hole";
  const priceStr = searchParams.get("price") || "";

  const [club, setClub] = useState<ClubProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const players = Number(playersParam);

  useEffect(() => {
    fetch(`${API_URL}/api/clubs/public/${params.slug}`)
      .then((r) => r.json())
      .then(setClub)
      .catch(console.error);
  }, [params.slug]);

  const timezone = club?.config?.timezone || "America/New_York";

  const formattedDate = datetime
    ? new Date(datetime).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: timezone,
      })
    : "";

  const formattedTime = datetime
    ? new Date(datetime).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      })
    : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        playersCount: players,
        guestName: name,
        guestEmail: email,
        notes: notes || undefined,
        clubSlug: params.slug,
      };

      if (slotId) {
        body.teeSlotId = slotId;
      } else {
        body.courseId = courseId;
        body.datetime = datetime;
      }

      const res = await fetch(`${API_URL}/api/bookings/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        router.push(
          `/book/${params.slug}/times?clubId=${clubId}&error=slot_full`
        );
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setSubmitting(false);
        return;
      }

      const booking = await res.json();
      const q = new URLSearchParams({
        bookingRef: booking.bookingRef,
        datetime: booking.datetime,
        players: String(players),
        guestName: name,
        guestEmail: email,
      });
      router.push(`/book/${params.slug}/success?${q.toString()}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
          <h1 className="font-semibold text-gray-800">Confirm Booking</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Summary card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-1">
            {club?.name ?? "Loading..."}
          </h2>
          <p className="text-sm text-gray-600">
            {players} player{players !== 1 ? "s" : ""} · {formattedDate} ·{" "}
            {formattedTime}
            {priceStr ? ` · $${priceStr}/player` : ""}
          </p>
          <p className="text-xs text-gray-400 mt-1 capitalize">
            {slotType.replace("hole", " holes")}
          </p>
        </div>

        {/* Cancellation policy */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Free cancellation</span> up to{" "}
            {club?.config?.cancellationHours ?? 24} hours before your tee time.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name *
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email *
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Special Requests{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Left-handed clubs, wheelchair accessible cart, etc."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {notes.length}/500
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !name || !email}
            className={`w-full py-4 rounded-xl text-lg font-semibold transition-colors shadow-md ${
              submitting || !name || !email
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Reserving...
              </span>
            ) : (
              "Reserve Tee Time"
            )}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Back to tee times
          </button>
        </div>
      </div>
    </main>
  );
}
