"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";

export default function ClubBookingsStubPage() {
  return (
    <>
      <SetTopBar title="Bookings" />
      <div className="p-6">
        <h2 className="font-display text-xl text-ink">Bookings</h2>
      </div>
    </>
  );
}
