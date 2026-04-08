import { z } from "zod";

export const ProfileUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).nullable().optional(),
  notificationPrefs: z
    .object({ reminders: z.boolean() })
    .nullable()
    .optional(),
});

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
