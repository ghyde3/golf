CREATE TABLE "club_tag_assignments" (
	"club_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "club_tag_assignments_club_id_tag_id_pk" PRIMARY KEY("club_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "club_tag_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"group_name" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "club_tag_definitions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "club_tag_assignments" ADD CONSTRAINT "club_tag_assignments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_tag_assignments" ADD CONSTRAINT "club_tag_assignments_tag_id_club_tag_definitions_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."club_tag_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_tag_assignments_tag_id_idx" ON "club_tag_assignments" USING btree ("tag_id");