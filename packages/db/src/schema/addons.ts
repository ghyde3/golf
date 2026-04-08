import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clubs } from "./clubs";
import { bookings } from "./bookings";
import { resourceTypes, resourceItems } from "./resources";
import { users } from "./users";

export const addonCatalog = pgTable("addon_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .references(() => clubs.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  resourceTypeId: uuid("resource_type_id").references(() => resourceTypes.id, {
    onDelete: "set null",
  }),
  unitsConsumed: integer("units_consumed").notNull().default(1),
  taxable: boolean("taxable").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const bookingAddonLines = pgTable(
  "booking_addon_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .references(() => bookings.id, { onDelete: "cascade" })
      .notNull(),
    addonCatalogId: uuid("addon_catalog_id")
      .references(() => addonCatalog.id, { onDelete: "restrict" })
      .notNull(),
    resourceTypeId: uuid("resource_type_id").references(() => resourceTypes.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    bookingStart: timestamp("booking_start", { withTimezone: true }),
    bookingEnd: timestamp("booking_end", { withTimezone: true }),
    status: text("status").notNull().default("confirmed"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_addon_lines_resource_type_booking_window_idx").on(
      t.resourceTypeId,
      t.bookingStart,
      t.bookingEnd
    ),
  ]
);

export const bookingResourceAssignments = pgTable(
  "booking_resource_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingAddonLineId: uuid("booking_addon_line_id")
      .references(() => bookingAddonLines.id, { onDelete: "cascade" })
      .notNull(),
    resourceItemId: uuid("resource_item_id")
      .references(() => resourceItems.id)
      .notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
  },
  (t) => [
    index("booking_resource_assignments_booking_addon_line_id_superseded_at_idx").on(
      t.bookingAddonLineId,
      t.supersededAt
    ),
    index("booking_resource_assignments_resource_item_id_idx").on(t.resourceItemId),
  ]
);

export const addonCatalogRelations = relations(addonCatalog, ({ one, many }) => ({
  club: one(clubs, {
    fields: [addonCatalog.clubId],
    references: [clubs.id],
  }),
  resourceType: one(resourceTypes, {
    fields: [addonCatalog.resourceTypeId],
    references: [resourceTypes.id],
  }),
  bookingLines: many(bookingAddonLines),
}));

export const bookingAddonLinesRelations = relations(bookingAddonLines, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [bookingAddonLines.bookingId],
    references: [bookings.id],
  }),
  catalogItem: one(addonCatalog, {
    fields: [bookingAddonLines.addonCatalogId],
    references: [addonCatalog.id],
  }),
  resourceType: one(resourceTypes, {
    fields: [bookingAddonLines.resourceTypeId],
    references: [resourceTypes.id],
  }),
  assignments: many(bookingResourceAssignments),
}));

export const bookingResourceAssignmentsRelations = relations(
  bookingResourceAssignments,
  ({ one }) => ({
    bookingAddonLine: one(bookingAddonLines, {
      fields: [bookingResourceAssignments.bookingAddonLineId],
      references: [bookingAddonLines.id],
    }),
    resourceItem: one(resourceItems, {
      fields: [bookingResourceAssignments.resourceItemId],
      references: [resourceItems.id],
    }),
    assignedByUser: one(users, {
      fields: [bookingResourceAssignments.assignedBy],
      references: [users.id],
    }),
  })
);
