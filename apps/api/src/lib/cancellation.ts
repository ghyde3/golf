import { differenceInHours } from "date-fns";

export function isCancellable(
  slotDatetime: Date,
  cancellationHours: number
): boolean {
  return differenceInHours(slotDatetime, new Date()) >= cancellationHours;
}
