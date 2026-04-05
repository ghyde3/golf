import { z } from "zod";

export const CreateBookingSchema = z.object({
  teeSlotId: z.string().uuid(),
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
});

export const PublicCreateBookingSchema = CreateBookingSchema;

export type CreateBooking = z.infer<typeof CreateBookingSchema>;
