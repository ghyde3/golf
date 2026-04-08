import {
  pgTable,
  uuid,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { bookings } from "./bookings";
import { users } from "./users";
import { courses } from "./clubs";

export const roundScorecards = pgTable("round_scorecards", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .references(() => bookings.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  courseId: uuid("course_id").references(() => courses.id, {
    onDelete: "set null",
  }),
  totalScore: integer("total_score").notNull(),
  completedHoles: integer("completed_holes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const roundScorecardHoles = pgTable(
  "round_scorecard_holes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scorecardId: uuid("scorecard_id")
      .references(() => roundScorecards.id, { onDelete: "cascade" })
      .notNull(),
    holeNumber: integer("hole_number").notNull(),
    score: integer("score").notNull(),
  },
  (table) => [unique().on(table.scorecardId, table.holeNumber)]
);

export const roundScorecardsRelations = relations(
  roundScorecards,
  ({ one, many }) => ({
    booking: one(bookings, {
      fields: [roundScorecards.bookingId],
      references: [bookings.id],
    }),
    user: one(users, {
      fields: [roundScorecards.userId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [roundScorecards.courseId],
      references: [courses.id],
    }),
    holes: many(roundScorecardHoles),
  })
);

export const roundScorecardHolesRelations = relations(
  roundScorecardHoles,
  ({ one }) => ({
    scorecard: one(roundScorecards, {
      fields: [roundScorecardHoles.scorecardId],
      references: [roundScorecards.id],
    }),
  })
);
