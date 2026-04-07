CREATE TABLE "booking_resource_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_addon_line_id" uuid NOT NULL,
	"resource_item_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pool_maintenance_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"units" integer NOT NULL,
	"reason" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "resource_item_status_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_item_id" uuid NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"reason" text,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"label" text NOT NULL,
	"operational_status" text NOT NULL,
	"maintenance_note" text,
	"last_serviced_at" timestamp with time zone,
	"meta" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_restock_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type_id" uuid NOT NULL,
	"delta_quantity" integer NOT NULL,
	"reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"usage_model" text NOT NULL,
	"tracking_mode" text,
	"assignment_strategy" text NOT NULL,
	"total_units" integer,
	"track_inventory" boolean DEFAULT true NOT NULL,
	"current_stock" integer,
	"rental_windows" jsonb,
	"turnaround_buffer_minutes" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_resource_assignments" ADD CONSTRAINT "booking_resource_assignments_resource_item_id_resource_items_id_fk" FOREIGN KEY ("resource_item_id") REFERENCES "public"."resource_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_resource_assignments" ADD CONSTRAINT "booking_resource_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_maintenance_holds" ADD CONSTRAINT "pool_maintenance_holds_resource_type_id_resource_types_id_fk" FOREIGN KEY ("resource_type_id") REFERENCES "public"."resource_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_maintenance_holds" ADD CONSTRAINT "pool_maintenance_holds_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_maintenance_holds" ADD CONSTRAINT "pool_maintenance_holds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_maintenance_holds" ADD CONSTRAINT "pool_maintenance_holds_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_item_status_log" ADD CONSTRAINT "resource_item_status_log_resource_item_id_resource_items_id_fk" FOREIGN KEY ("resource_item_id") REFERENCES "public"."resource_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_item_status_log" ADD CONSTRAINT "resource_item_status_log_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_items" ADD CONSTRAINT "resource_items_resource_type_id_resource_types_id_fk" FOREIGN KEY ("resource_type_id") REFERENCES "public"."resource_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_items" ADD CONSTRAINT "resource_items_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_restock_log" ADD CONSTRAINT "resource_restock_log_resource_type_id_resource_types_id_fk" FOREIGN KEY ("resource_type_id") REFERENCES "public"."resource_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_restock_log" ADD CONSTRAINT "resource_restock_log_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_types" ADD CONSTRAINT "resource_types_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_resource_assignments_booking_addon_line_id_superseded_at_idx" ON "booking_resource_assignments" USING btree ("booking_addon_line_id","superseded_at");--> statement-breakpoint
CREATE INDEX "booking_resource_assignments_resource_item_id_idx" ON "booking_resource_assignments" USING btree ("resource_item_id");--> statement-breakpoint
CREATE INDEX "pool_maintenance_holds_resource_type_id_resolved_at_idx" ON "pool_maintenance_holds" USING btree ("resource_type_id","resolved_at");--> statement-breakpoint
CREATE INDEX "resource_item_status_log_resource_item_id_changed_at_idx" ON "resource_item_status_log" USING btree ("resource_item_id","changed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "resource_items_resource_type_id_operational_status_idx" ON "resource_items" USING btree ("resource_type_id","operational_status");--> statement-breakpoint
CREATE INDEX "resource_items_club_id_idx" ON "resource_items" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "resource_restock_log_resource_type_id_created_at_idx" ON "resource_restock_log" USING btree ("resource_type_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "tee_slots" ADD CONSTRAINT "tee_slots_slot_type_valid" CHECK ("tee_slots"."slot_type" IN ('9hole', '18hole', '27hole', '36hole'));