import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clubs } from "./clubs-base";

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .references(() => clubs.id, { onDelete: "cascade" })
    .notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  status: text("status").notNull().default("draft"),
  stripeInvoiceId: text("stripe_invoice_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const invoicesRelations = relations(invoices, ({ one }) => ({
  club: one(clubs, { fields: [invoices.clubId], references: [clubs.id] }),
}));
