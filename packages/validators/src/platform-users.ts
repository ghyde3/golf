import { z } from "zod";

export const PlatformUserPatchSchema = z
  .object({
    status: z.enum(["active", "suspended"]).optional(),
    role: z.enum(["platform_admin", "club_admin", "staff", "golfer"]).optional(),
  })
  .refine((d) => d.status !== undefined || d.role !== undefined, {
    message: "At least one of status or role is required",
  });
