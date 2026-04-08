import { z } from "zod";

export const JoinWaitlistSchema = z.object({
  teeSlotId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  playersCount: z.number().int().min(1).max(4),
});

export type JoinWaitlistInput = z.infer<typeof JoinWaitlistSchema>;
