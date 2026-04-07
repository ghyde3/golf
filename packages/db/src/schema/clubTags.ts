import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clubs } from "./clubs";

export const clubTagDefinitions = pgTable("club_tag_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  groupName: text("group_name"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const clubTagAssignments = pgTable(
  "club_tag_assignments",
  {
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => clubTagDefinitions.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.clubId, t.tagId] }),
    index("club_tag_assignments_tag_id_idx").on(t.tagId),
  ]
);

export const clubTagDefinitionsRelations = relations(
  clubTagDefinitions,
  ({ many }) => ({
    assignments: many(clubTagAssignments),
  })
);

export const clubTagAssignmentsRelations = relations(
  clubTagAssignments,
  ({ one }) => ({
    club: one(clubs, {
      fields: [clubTagAssignments.clubId],
      references: [clubs.id],
    }),
    tag: one(clubTagDefinitions, {
      fields: [clubTagAssignments.tagId],
      references: [clubTagDefinitions.id],
    }),
  })
);
