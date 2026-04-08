import { z } from "zod";

export const ScorecardSubmitSchema = z.object({
  bookingId: z.string().uuid(),
  holes: z
    .array(
      z.object({
        holeNumber: z.number().int().min(1).max(18),
        score: z.number().int().min(1).max(20),
      })
    )
    .min(1)
    .max(18),
});

export type ScorecardSubmit = z.infer<typeof ScorecardSubmitSchema>;
