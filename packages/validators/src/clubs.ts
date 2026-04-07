import { z } from "zod";

export const CreateClubSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      "Lowercase letters, numbers, hyphens only"
    ),
  timezone: z.string(),
  description: z.string().max(500).optional(),
  /** Public search / listing card image (URL or site path like `/pinebrook.png`). */
  heroImageUrl: z.string().max(2048).optional(),
});

export const ScheduleDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const ClubConfigSchema = z.object({
  slotIntervalMinutes: z.union([
    z.literal(8),
    z.literal(10),
    z.literal(12),
  ]),
  bookingWindowDays: z.number().int().min(1).max(90),
  cancellationHours: z.number().int().min(0),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  schedule: z.array(ScheduleDaySchema).max(7).optional(),
  timezone: z.string(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CreateClub = z.infer<typeof CreateClubSchema>;

/** Club admin: listing image shown on public search (URL or path under the web app). */
export const ClubProfilePatchSchema = z.object({
  heroImageUrl: z.string().max(2048).nullable(),
});
export type ScheduleDay = z.infer<typeof ScheduleDaySchema>;
export type ClubConfig = z.infer<typeof ClubConfigSchema>;
