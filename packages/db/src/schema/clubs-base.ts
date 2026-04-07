import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  doublePrecision,
} from "drizzle-orm/pg-core";

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
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
