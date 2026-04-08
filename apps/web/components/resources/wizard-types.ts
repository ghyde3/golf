export type WizardFormData = {
  name: string;
  notes: string;
  trackingMode: "pool" | "individual";
  assignmentStrategy: "auto" | "manual";
  /** Pool: fleet size. Individual: number of unit rows to create after the type is saved. */
  totalUnits: number;
  rentalHours: Record<string, string>;
  /** When true, one duration applies to all round lengths (stored duplicated per API key). */
  syncRentalWindows: boolean;
  turnaroundBufferMinutes: number;
  startingStock: number;
  serviceAvailability: "manual" | "always";
};

export const WINDOW_KEYS = [
  "9hole",
  "18hole",
  "27hole",
  "36hole",
  "default",
] as const;

export function defaultWizardForm(): WizardFormData {
  return {
    name: "",
    notes: "",
    trackingMode: "pool",
    assignmentStrategy: "manual",
    totalUnits: 8,
    rentalHours: {
      "9hole": "2.5",
      "18hole": "4.5",
      "27hole": "6.5",
      "36hole": "8.5",
      default: "4.5",
    },
    syncRentalWindows: true,
    turnaroundBufferMinutes: 15,
    startingStock: 0,
    serviceAvailability: "always",
  };
}

export function hoursInputToMinutes(h: string): number {
  const n = parseFloat(h.replace(",", "."));
  if (Number.isNaN(n) || n <= 0) return 60;
  return Math.round(n * 60);
}

/** API stores rental window lengths as whole minutes. */
export function minutesToHoursDisplay(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "1";
  const h = minutes / 60;
  const rounded = Math.round(h * 100) / 100;
  if (rounded === Math.floor(rounded)) return String(Math.floor(rounded));
  return String(rounded);
}

export function rentalHoursStringsFromApi(
  rw: Record<string, number> | null | undefined
): { rentalHours: Record<string, string>; syncRentalWindows: boolean } {
  const rentalHours: Record<string, string> = {};
  const sample = rw ?? {};
  for (const k of WINDOW_KEYS) {
    rentalHours[k] = minutesToHoursDisplay(sample[k] ?? 270);
  }
  const vals = WINDOW_KEYS.map((k) => rentalHours[k]);
  const sync = vals.every((v) => v === vals[0]);
  return { rentalHours, syncRentalWindows: sync };
}

export function rentalWindowsPayloadFromForm(
  rentalHours: Record<string, string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of WINDOW_KEYS) {
    out[k] = hoursInputToMinutes(rentalHours[k] ?? "4.5");
  }
  return out;
}
