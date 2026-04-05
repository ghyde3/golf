import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const failedJobs = pgTable("failed_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobName: text("job_name").notNull(),
  jobData: jsonb("job_data").notNull(),
  error: text("error").notNull(),
  failedAt: timestamp("failed_at", { withTimezone: true }).defaultNow(),
});
