import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { courses } from "./clubs";
import { users } from "./users";

export const teeSlots = pgTable(
  "tee_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    datetime: timestamp("datetime", { withTimezone: true }).notNull(),
    maxPlayers: integer("max_players").default(4),
    bookedPlayers: integer("booked_players").default(0),
    status: text("status").default("open"),
    price: numeric("price", { precision: 8, scale: 2 }),
    slotType: text("slot_type").default("18hole"),
  },
  (table) => [
    check("no_overbooking", sql`${table.bookedPlayers} <= ${table.maxPlayers}`),
    check(
      "tee_slots_slot_type_valid",
      sql`${table.slotType} IN ('9hole', '18hole', '27hole', '36hole')`
    ),
  ]
);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingRef: text("booking_ref").unique().notNull(),
  teeSlotId: uuid("tee_slot_id").references(() => teeSlots.id),
  userId: uuid("user_id").references(() => users.id),
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  playersCount: integer("players_count").notNull(),
  notes: text("notes"),
  status: text("status").default("confirmed"),
  paymentStatus: text("payment_status").default("unpaid"),
  source: text("source").notNull().default("online_guest"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const bookingPlayers = pgTable("booking_players", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .references(() => bookings.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name"),
  email: text("email"),
  checkedIn: boolean("checked_in").default(false),
  noShow: boolean("no_show").default(false),
});

export const teeSlotsRelations = relations(teeSlots, ({ one, many }) => ({
  course: one(courses, {
    fields: [teeSlots.courseId],
    references: [courses.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  teeSlot: one(teeSlots, {
    fields: [bookings.teeSlotId],
    references: [teeSlots.id],
  }),
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  players: many(bookingPlayers),
}));

export const bookingPlayersRelations = relations(
  bookingPlayers,
  ({ one }) => ({
    booking: one(bookings, {
      fields: [bookingPlayers.bookingId],
      references: [bookings.id],
    }),
  })
);
