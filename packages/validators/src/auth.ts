import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const PlatformClubStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export type PlatformClubStatusPatch = z.infer<typeof PlatformClubStatusSchema>;

export const SetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(100),
});

export const StaffInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["staff", "club_admin"]),
});

export const TeeSheetBlockSchema = z.object({
  courseId: z.string().uuid(),
  datetime: z.string(),
  maxPlayers: z.number().int().min(1).max(8).optional(),
});
