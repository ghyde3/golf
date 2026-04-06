"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";

export default function ClubStaffStubPage() {
  return (
    <>
      <SetTopBar title="Staff" />
      <div className="p-6">
        <h2 className="font-display text-xl text-ink">Staff</h2>
      </div>
    </>
  );
}
