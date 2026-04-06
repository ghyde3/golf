import { z } from "zod";

export const CourseSchema = z.object({
  name: z.string().min(1),
  holes: z.union([z.literal(9), z.literal(18)]),
});

export const CoursePatchSchema = CourseSchema.partial();

export type Course = z.infer<typeof CourseSchema>;
