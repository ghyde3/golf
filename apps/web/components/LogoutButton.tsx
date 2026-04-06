"use client";

import { SignOutDialog } from "@/components/SignOutDialog";
import { useState } from "react";

export function LogoutButton() {
  const [signOutOpen, setSignOutOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setSignOutOpen(true)}
        className="text-sm text-white/40 transition-colors hover:text-white/70"
      >
        Sign out
      </button>
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  );
}
