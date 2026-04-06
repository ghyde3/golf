import { describe, it, expect } from "vitest";
import { CreateClubSchema, ClubConfigSchema } from "./clubs";

describe("CreateClubSchema", () => {
  it("accepts valid slug and name", () => {
    const r = CreateClubSchema.safeParse({
      name: "Oak Hills",
      slug: "oak-hills",
      timezone: "America/New_York",
    });
    expect(r.success).toBe(true);
  });

  it("rejects uppercase in slug", () => {
    const r = CreateClubSchema.safeParse({
      name: "Oak Hills",
      slug: "Oak-Hills",
      timezone: "America/New_York",
    });
    expect(r.success).toBe(false);
  });
});

describe("ClubConfigSchema", () => {
  it("accepts allowed slot intervals", () => {
    const base = {
      bookingWindowDays: 14,
      cancellationHours: 24,
      openTime: "06:00",
      closeTime: "18:00",
      timezone: "America/New_York",
      effectiveFrom: "2025-01-01",
    };
    expect(
      ClubConfigSchema.safeParse({ ...base, slotIntervalMinutes: 10 }).success
    ).toBe(true);
    expect(
      ClubConfigSchema.safeParse({ ...base, slotIntervalMinutes: 7 }).success
    ).toBe(false);
  });
});
