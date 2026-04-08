import { z } from "zod";

export const AddonLineInputSchema = z.object({
  addonCatalogId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
});

export const CreateAddonCatalogSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().min(0),
  resourceTypeId: z.string().uuid().optional().nullable(),
  unitsConsumed: z.number().int().min(1).max(20).optional(),
  taxable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const PatchAddonCatalogSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  resourceTypeId: z.string().uuid().nullable().optional(),
  unitsConsumed: z.number().int().min(1).max(20).optional(),
  taxable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export type AddonLineInput = z.infer<typeof AddonLineInputSchema>;
