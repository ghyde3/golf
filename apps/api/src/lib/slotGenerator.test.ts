import { describe, it, expect } from "vitest";
import { generateSlots } from "./slotGenerator";

describe("generateSlots", () => {
  it("emits slots from open to close by interval", () => {
    const slots = generateSlots(
      {
        openTime: "06:00",
        closeTime: "07:00",
        slotIntervalMinutes: 15,
        timezone: "UTC",
      },
      "2025-01-15"
    );
    expect(slots.length).toBe(4);
    expect(slots[0].status).toBe("open");
    expect(slots.every((s) => s.maxPlayers === 4)).toBe(true);
  });
});
