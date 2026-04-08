import { z } from "zod";
import { AddonLineInputSchema } from "./addons";

export const CreateBookingSchema = z.object({
  teeSlotId: z.string().uuid(),
  playersCount: z.number().int().min(1).max(4),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  notes: z.string().max(500).optional(),
  addOns: z.array(AddonLineInputSchema).optional(),
  players: z
    .array(
      z.object({
        name: z.string(),
        email: z.string().email().optional(),
      })
    )
    .optional(),
});

export const PublicCreateBookingSchema = CreateBookingSchema;

export const PublicBookingBodySchema = z
  .object({
    teeSlotId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    datetime: z.string().optional(),
    clubSlug: z.string().optional(),
    playersCount: z.number().int().min(1).max(4),
    guestName: z.string().min(1),
    guestEmail: z.string().email(),
    notes: z.string().max(500).optional(),
    players: z
      .array(
        z.object({
          name: z.string(),
          email: z.string().email().optional(),
        })
      )
      .optional(),
    addOns: z.array(AddonLineInputSchema).optional(),
  })
  .refine((d) => d.teeSlotId || (d.courseId && d.datetime), {
    message: "Provide teeSlotId or both courseId and datetime",
    path: ["teeSlotId"],
  });

export type CreateBooking = z.infer<typeof CreateBookingSchema>;

export const MeBookingsQuerySchema = z.object({
  upcoming: z.union([z.literal("true"), z.literal("false")]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
