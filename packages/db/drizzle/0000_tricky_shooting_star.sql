CREATE TABLE "booking_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"name" text,
	"email" text,
	"checked_in" boolean DEFAULT false,
	"no_show" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_ref" text NOT NULL,
	"tee_slot_id" uuid,
	"user_id" uuid,
	"guest_name" text,
	"guest_email" text,
	"players_count" integer NOT NULL,
	"notes" text,
	"status" text DEFAULT 'confirmed',
	"payment_status" text DEFAULT 'unpaid',
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "bookings_booking_ref_unique" UNIQUE("booking_ref")
);
--> statement-breakpoint
CREATE TABLE "tee_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"datetime" timestamp with time zone NOT NULL,
	"max_players" integer DEFAULT 4,
	"booked_players" integer DEFAULT 0,
	"status" text DEFAULT 'open',
	"price" numeric(8, 2),
	"slot_type" text DEFAULT '18hole',
	CONSTRAINT "no_overbooking" CHECK ("tee_slots"."booked_players" <= "tee_slots"."max_players")
);
--> statement-breakpoint
CREATE TABLE "club_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"effective_from" date DEFAULT now() NOT NULL,
	"slot_interval_minutes" integer DEFAULT 10,
	"booking_window_days" integer DEFAULT 14,
	"cancellation_hours" integer DEFAULT 24,
	"open_time" time DEFAULT '06:00',
	"close_time" time DEFAULT '18:00',
	"schedule" jsonb,
	"timezone" text DEFAULT 'America/New_York',
	"logo_url" text,
	"primary_color" text DEFAULT '#16a34a',
	CONSTRAINT "club_config_club_id_effective_from_unique" UNIQUE("club_id","effective_from")
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active',
	"subscription_type" text DEFAULT 'trial',
	"booking_fee" numeric(5, 2) DEFAULT '0',
	"description" text,
	"hero_image_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"holes" integer DEFAULT 18 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"club_id" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "failed_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"job_data" jsonb NOT NULL,
	"error" text NOT NULL,
	"failed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "booking_players" ADD CONSTRAINT "booking_players_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tee_slot_id_tee_slots_id_fk" FOREIGN KEY ("tee_slot_id") REFERENCES "public"."tee_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tee_slots" ADD CONSTRAINT "tee_slots_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_config" ADD CONSTRAINT "club_config_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;