import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clubs } from "./clubs-base";
import { users } from "./users";

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience").notNull().default("all"),
  clubId: uuid("club_id").references(() => clubs.id),
  status: text("status").notNull().default("draft"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const announcementsRelations = relations(announcements, ({ one }) => ({
  club: one(clubs, { fields: [announcements.clubId], references: [clubs.id] }),
  createdByUser: one(users, {
    fields: [announcements.createdBy],
    references: [users.id],
  }),
}));
