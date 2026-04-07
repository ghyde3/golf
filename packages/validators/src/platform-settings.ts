import { z } from "zod";

export const PlatformSettingValueSchema = z.object({
  value: z.unknown(),
});
