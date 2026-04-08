interface SlotConfig {
  openTime: string;
  closeTime: string;
  slotIntervalMinutes: number;
  timezone: string;
}

export interface GeneratedSlot {
  datetime: Date;
  maxPlayers: number;
  bookedPlayers: number;
  status: "open" | "blocked";
  price: number | null;
  slotType: "18hole" | "9hole" | "27hole" | "36hole";
}

export function generateSlots(
  config: SlotConfig,
  localDate: string
): GeneratedSlot[] {
  const slots: GeneratedSlot[] = [];

  const [openH, openM] = config.openTime.split(":").map(Number);
  const [closeH, closeM] = config.closeTime.split(":").map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const tzOffsetMs = getTimezoneOffset(config.timezone, localDate);

  for (
    let mins = openMinutes;
    mins < closeMinutes;
    mins += config.slotIntervalMinutes
  ) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const localIso = `${localDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    const utcMs = new Date(localIso + "Z").getTime() - tzOffsetMs;

    slots.push({
      datetime: new Date(utcMs),
      maxPlayers: 4,
      bookedPlayers: 0,
      status: "open",
      price: null,
      slotType: "18hole",
    });
  }

  return slots;
}

function getTimezoneOffset(timezone: string, dateStr: string): number {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
  return new Date(tzStr).getTime() - new Date(utcStr).getTime();
}
