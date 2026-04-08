CREATE TABLE "course_holes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"par" integer NOT NULL,
	"handicap_index" integer,
	"yardage" integer,
	CONSTRAINT "course_holes_course_id_hole_number_unique" UNIQUE("course_id","hole_number")
);
--> statement-breakpoint
CREATE TABLE "round_scorecard_holes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scorecard_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"score" integer NOT NULL,
	CONSTRAINT "round_scorecard_holes_scorecard_id_hole_number_unique" UNIQUE("scorecard_id","hole_number")
);
--> statement-breakpoint
CREATE TABLE "round_scorecards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid,
	"total_score" integer NOT NULL,
	"completed_holes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "round_scorecards_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_prefs" jsonb;--> statement-breakpoint
ALTER TABLE "course_holes" ADD CONSTRAINT "course_holes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_scorecard_holes" ADD CONSTRAINT "round_scorecard_holes_scorecard_id_round_scorecards_id_fk" FOREIGN KEY ("scorecard_id") REFERENCES "public"."round_scorecards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_scorecards" ADD CONSTRAINT "round_scorecards_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_scorecards" ADD CONSTRAINT "round_scorecards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_scorecards" ADD CONSTRAINT "round_scorecards_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;