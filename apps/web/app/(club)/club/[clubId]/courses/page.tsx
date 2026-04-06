"use client";

import { SetTopBar } from "@/components/club/ClubTopBarContext";

export default function ClubCoursesStubPage() {
  return (
    <>
      <SetTopBar title="Courses" />
      <div className="p-6">
        <h2 className="font-display text-xl text-ink">Courses</h2>
      </div>
    </>
  );
}
