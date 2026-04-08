import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clubs } from "./clubs";
import { users } from "./users";

export const resourceTypes = pgTable("resource_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .references(() => clubs.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  usageModel: text("usage_model").notNull(),
  trackingMode: text("tracking_mode"),
  assignmentStrategy: text("assignment_strategy").notNull(),
  totalUnits: integer("total_units"),
  trackInventory: boolean("track_inventory").notNull().default(true),
  currentStock: integer("current_stock"),
  rentalWindows: jsonb("rental_windows"),
  turnaroundBufferMinutes: integer("turnaround_buffer_minutes").notNull().default(0),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resourceItems = pgTable(
  "resource_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceTypeId: uuid("resource_type_id")
      .references(() => resourceTypes.id, { onDelete: "cascade" })
      .notNull(),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    operationalStatus: text("operational_status").notNull(),
    maintenanceNote: text("maintenance_note"),
    lastServicedAt: timestamp("last_serviced_at", { withTimezone: true }),
    meta: jsonb("meta"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("resource_items_resource_type_id_operational_status_idx").on(
      t.resourceTypeId,
      t.operationalStatus
    ),
    index("resource_items_club_id_idx").on(t.clubId),
  ]
);

export const poolMaintenanceHolds = pgTable(
  "pool_maintenance_holds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceTypeId: uuid("resource_type_id")
      .references(() => resourceTypes.id, { onDelete: "cascade" })
      .notNull(),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    units: integer("units").notNull(),
    reason: text("reason"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    resolvedBy: uuid("resolved_by").references(() => users.id),
  },
  (t) => [
    index("pool_maintenance_holds_resource_type_id_resolved_at_idx").on(
      t.resourceTypeId,
      t.resolvedAt
    ),
  ]
);

export const resourceItemStatusLog = pgTable(
  "resource_item_status_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceItemId: uuid("resource_item_id")
      .references(() => resourceItems.id, { onDelete: "cascade" })
      .notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    changedBy: uuid("changed_by")
      .references(() => users.id)
      .notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resource_item_status_log_resource_item_id_changed_at_idx").on(
      t.resourceItemId,
      t.changedAt.desc()
    ),
  ]
);

export const resourceRestockLog = pgTable(
  "resource_restock_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceTypeId: uuid("resource_type_id")
      .references(() => resourceTypes.id, { onDelete: "cascade" })
      .notNull(),
    deltaQuantity: integer("delta_quantity").notNull(),
    reason: text("reason"),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resource_restock_log_resource_type_id_created_at_idx").on(
      t.resourceTypeId,
      t.createdAt.desc()
    ),
  ]
);

export const resourceTypesRelations = relations(resourceTypes, ({ many }) => ({
  resourceItems: many(resourceItems),
  poolMaintenanceHolds: many(poolMaintenanceHolds),
  resourceRestockLogs: many(resourceRestockLog),
}));

export const resourceItemsRelations = relations(resourceItems, ({ one, many }) => ({
  resourceType: one(resourceTypes, {
    fields: [resourceItems.resourceTypeId],
    references: [resourceTypes.id],
  }),
  club: one(clubs, {
    fields: [resourceItems.clubId],
    references: [clubs.id],
  }),
  resourceItemStatusLogs: many(resourceItemStatusLog),
}));

export const poolMaintenanceHoldsRelations = relations(poolMaintenanceHolds, ({ one }) => ({
  resourceType: one(resourceTypes, {
    fields: [poolMaintenanceHolds.resourceTypeId],
    references: [resourceTypes.id],
  }),
  club: one(clubs, {
    fields: [poolMaintenanceHolds.clubId],
    references: [clubs.id],
  }),
  createdByUser: one(users, {
    fields: [poolMaintenanceHolds.createdBy],
    references: [users.id],
  }),
  resolvedByUser: one(users, {
    fields: [poolMaintenanceHolds.resolvedBy],
    references: [users.id],
  }),
}));

export const resourceItemStatusLogRelations = relations(resourceItemStatusLog, ({ one }) => ({
  resourceItem: one(resourceItems, {
    fields: [resourceItemStatusLog.resourceItemId],
    references: [resourceItems.id],
  }),
  changedByUser: one(users, {
    fields: [resourceItemStatusLog.changedBy],
    references: [users.id],
  }),
}));

export const resourceRestockLogRelations = relations(resourceRestockLog, ({ one }) => ({
  resourceType: one(resourceTypes, {
    fields: [resourceRestockLog.resourceTypeId],
    references: [resourceTypes.id],
  }),
  createdByUser: one(users, {
    fields: [resourceRestockLog.createdBy],
    references: [users.id],
  }),
}));
