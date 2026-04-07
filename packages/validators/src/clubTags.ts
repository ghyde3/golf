import { z } from "zod";

const tagSlug = z
  .string()
  .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only");

export const ClubTagDefinitionCreateSchema = z.object({
  slug: tagSlug,
  label: z.string().min(1).max(120),
  sortOrder: z.number().int().min(0).max(999999).optional(),
  groupName: z.string().max(80).nullable().optional(),
  active: z.boolean().optional(),
});

export const ClubTagDefinitionPatchSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  sortOrder: z.number().int().min(0).max(999999).optional(),
  groupName: z.string().max(80).nullable().optional(),
  active: z.boolean().optional(),
});

/** Club admin: replace all listing tag assignments (platform catalog slugs only). */
export const ClubTagSlugsPutSchema = z
  .object({
    tagSlugs: z.array(tagSlug).max(50),
  })
  .refine((x) => new Set(x.tagSlugs).size === x.tagSlugs.length, {
    message: "tagSlugs must be unique",
  });

export type ClubTagDefinitionCreate = z.infer<
  typeof ClubTagDefinitionCreateSchema
>;
export type ClubTagDefinitionPatch = z.infer<
  typeof ClubTagDefinitionPatchSchema
>;
