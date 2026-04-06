import { describe, it, expect } from "vitest";
import { resolveConfig, resolveHours } from "./configResolver";

describe("resolveConfig", () => {
  it("picks latest effectiveFrom not after target date", () => {
    const configs = [
      {
        effectiveFrom: "2025-01-01",
        slotIntervalMinutes: 10,
        openTime: "06:00",
        closeTime: "18:00",
        schedule: null,
        timezone: "UTC",
      },
      {
        effectiveFrom: "2025-06-01",
        slotIntervalMinutes: 8,
        openTime: "07:00",
        closeTime: "19:00",
        schedule: null,
        timezone: "UTC",
      },
    ];
    const july = resolveConfig(configs, new Date("2025-07-15"));
    expect(july.slotIntervalMinutes).toBe(8);

    const may = resolveConfig(configs, new Date("2025-05-15"));
    expect(may.slotIntervalMinutes).toBe(10);
  });
});

describe("resolveHours", () => {
  it("uses schedule entry for dayOfWeek when present", () => {
    const config = {
      effectiveFrom: "2025-01-01",
      slotIntervalMinutes: 10,
      openTime: "06:00",
      closeTime: "18:00",
      schedule: [{ dayOfWeek: 1, openTime: "08:00", closeTime: "16:00" }],
      timezone: "UTC",
    };
    const mon = resolveHours(config, 1);
    expect(mon).toEqual({ openTime: "08:00", closeTime: "16:00" });

    const tue = resolveHours(config, 2);
    expect(tue).toEqual({ openTime: "06:00", closeTime: "18:00" });
  });
});
