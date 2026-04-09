import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { clubs } from "./clubs";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash"),
  name: text("name"),
  phone: text("phone"),
  notificationPrefs: jsonb("notification_prefs"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").notNull(),
    clubId: uuid("club_id").references(() => clubs.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("user_roles_user_club_role_unique")
      .on(table.userId, table.clubId, table.role)
      .where(sql`${table.clubId} is not null`),
    uniqueIndex("user_roles_user_role_global_unique")
      .on(table.userId, table.role)
      .where(sql`${table.clubId} is null`),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  club: one(clubs, { fields: [userRoles.clubId], references: [clubs.id] }),
}));
