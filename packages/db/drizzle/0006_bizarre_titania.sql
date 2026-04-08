CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tee_slot_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"players_count" integer NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"notified_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_tee_slot_id_tee_slots_id_fk" FOREIGN KEY ("tee_slot_id") REFERENCES "public"."tee_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_tee_slot_email_unique" ON "waitlist_entries" USING btree ("tee_slot_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_token_unique" ON "waitlist_entries" USING btree ("token");--> statement-breakpoint
CREATE INDEX "waitlist_entries_tee_slot_created_idx" ON "waitlist_entries" USING btree ("tee_slot_id","created_at");