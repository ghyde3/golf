"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ClubProfile {
  name: string;
  slug: string;
  config: {
    timezone: string;
  };
}

export default function SuccessPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const [club, setClub] = useState<ClubProfile | null>(null);

  const bookingRef = searchParams.get("bookingRef") || "";
  const datetime = searchParams.get("datetime") || "";
  const players = searchParams.get("players") || "1";
  const guestName = searchParams.get("guestName") || "";
  const guestEmail = searchParams.get("guestEmail") || "";

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
        year: "numeric",
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

  return (
    <main className="min-h-screen bg-green-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Checkmark */}
        <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-800">You&apos;re Booked!</h1>
          <p className="text-gray-500 mt-2">
            Confirmation sent to{" "}
            <span className="font-medium text-gray-700">{guestEmail}</span>.
            <br />
            We&apos;ll remind you 24 hours before.
          </p>
        </div>

        {/* Booking card */}
        <div className="bg-white rounded-xl shadow-lg p-6 text-left space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">Club</p>
              <p className="font-semibold text-gray-800">
                {club?.name ?? params.slug}
              </p>
            </div>
            <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
              Confirmed
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium text-gray-800">{formattedDate}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Time</p>
              <p className="font-medium text-gray-800">{formattedTime}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-gray-500">Players</p>
              <p className="font-medium text-gray-800">{players}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium text-gray-800">{guestName}</p>
            </div>
          </div>

          <div className="border-t pt-3 mt-3">
            <p className="text-sm text-gray-500">Booking Reference</p>
            <p className="text-xl font-mono font-bold text-green-700 tracking-wider">
              {bookingRef}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <a
            href={`/book/${params.slug}`}
            className="block w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Book Another Tee Time
          </a>
        </div>
      </div>
    </main>
  );
}
