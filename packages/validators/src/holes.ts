import { z } from "zod";

export const HoleUpsertSchema = z
  .array(
    z.object({
      holeNumber: z.number().int().min(1).max(18),
      par: z.number().int().min(3).max(5),
      handicapIndex: z.number().int().min(1).max(18).nullable().optional(),
      yardage: z.number().int().min(1).max(1000).nullable().optional(),
    })
  )
  .min(1)
  .max(18);

export type HoleUpsert = z.infer<typeof HoleUpsertSchema>;
