import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  date,
  time,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clubs } from "./clubs-base";
import { invoices } from "./invoices";

export { clubs } from "./clubs-base";

export const clubConfig = pgTable(
  "club_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    effectiveFrom: date("effective_from").notNull().defaultNow(),
    slotIntervalMinutes: integer("slot_interval_minutes").default(10),
    bookingWindowDays: integer("booking_window_days").default(14),
    cancellationHours: integer("cancellation_hours").default(24),
    openTime: time("open_time").default("06:00"),
    closeTime: time("close_time").default("18:00"),
    schedule: jsonb("schedule"),
    timezone: text("timezone").default("America/New_York"),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color").default("#16a34a"),
  },
  (table) => [unique().on(table.clubId, table.effectiveFrom)]
);

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .references(() => clubs.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  holes: integer("holes").notNull().default(18),
});

export const clubsRelations = relations(clubs, ({ many }) => ({
  configs: many(clubConfig),
  courses: many(courses),
  invoices: many(invoices),
}));

export const clubConfigRelations = relations(clubConfig, ({ one }) => ({
  club: one(clubs, { fields: [clubConfig.clubId], references: [clubs.id] }),
}));

export const coursesRelations = relations(courses, ({ one }) => ({
  club: one(clubs, { fields: [courses.clubId], references: [clubs.id] }),
}));
