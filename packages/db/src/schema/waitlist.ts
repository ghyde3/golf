import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { teeSlots } from "./bookings";

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teeSlotId: uuid("tee_slot_id")
      .references(() => teeSlots.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    playersCount: integer("players_count").notNull(),
    token: uuid("token").notNull().defaultRandom(),
    /** Set when the "spot opened" email is successfully sent. */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    /** Set when the guest completes booking via the claim link. */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("waitlist_entries_tee_slot_email_unique").on(
      table.teeSlotId,
      table.email
    ),
    uniqueIndex("waitlist_entries_token_unique").on(table.token),
    index("waitlist_entries_tee_slot_created_idx").on(
      table.teeSlotId,
      table.createdAt
    ),
  ]
);

export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  teeSlot: one(teeSlots, {
    fields: [waitlistEntries.teeSlotId],
    references: [teeSlots.id],
  }),
}));
