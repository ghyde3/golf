CREATE TABLE "addon_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"resource_type_id" uuid,
	"units_consumed" integer DEFAULT 1 NOT NULL,
	"taxable" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_addon_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"addon_catalog_id" uuid NOT NULL,
	"resource_type_id" uuid,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"booking_start" timestamp with time zone,
	"booking_end" timestamp with time zone,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addon_catalog" ADD CONSTRAINT "addon_catalog_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_catalog" ADD CONSTRAINT "addon_catalog_resource_type_id_resource_types_id_fk" FOREIGN KEY ("resource_type_id") REFERENCES "public"."resource_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addon_lines" ADD CONSTRAINT "booking_addon_lines_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addon_lines" ADD CONSTRAINT "booking_addon_lines_addon_catalog_id_addon_catalog_id_fk" FOREIGN KEY ("addon_catalog_id") REFERENCES "public"."addon_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addon_lines" ADD CONSTRAINT "booking_addon_lines_resource_type_id_resource_types_id_fk" FOREIGN KEY ("resource_type_id") REFERENCES "public"."resource_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_addon_lines_resource_type_booking_window_idx" ON "booking_addon_lines" USING btree ("resource_type_id","booking_start","booking_end");--> statement-breakpoint
ALTER TABLE "booking_resource_assignments" ADD CONSTRAINT "booking_resource_assignments_booking_addon_line_id_booking_addon_lines_id_fk" FOREIGN KEY ("booking_addon_line_id") REFERENCES "public"."booking_addon_lines"("id") ON DELETE cascade ON UPDATE no action;