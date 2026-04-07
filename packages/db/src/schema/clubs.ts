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
  doublePrecision,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  status: text("status").default("active"),
  subscriptionType: text("subscription_type").default("trial"),
  bookingFee: numeric("booking_fee", { precision: 5, scale: 2 }).default("0"),
  description: text("description"),
  heroImageUrl: text("hero_image_url"),
  city: text("city"),
  state: text("state"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

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
}));

export const clubConfigRelations = relations(clubConfig, ({ one }) => ({
  club: one(clubs, { fields: [clubConfig.clubId], references: [clubs.id] }),
}));

export const coursesRelations = relations(courses, ({ one }) => ({
  club: one(clubs, { fields: [courses.clubId], references: [clubs.id] }),
}));
