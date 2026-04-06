"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";

export default function ClubSettingsStubPage() {
  return (
    <>
      <SetTopBar title="Settings" />
      <div className="p-6">
        <h2 className="font-display text-xl text-ink">Settings</h2>
      </div>
    </>
  );
}
