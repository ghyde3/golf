import { z } from "zod";

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  audience: z.enum(["all", "clubs", "club_specific"]).default("all"),
  clubId: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  publishAt: z.string().datetime().optional().nullable(),
});

export const PatchAnnouncementSchema = CreateAnnouncementSchema.partial();

export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;
export type PatchAnnouncementInput = z.infer<typeof PatchAnnouncementSchema>;
