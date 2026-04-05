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
