-- Remove duplicate club-scoped role rows (keep the row with the smallest id).
DELETE FROM "user_roles" ur
WHERE ur."club_id" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "user_roles" ur2
    WHERE ur2."user_id" = ur."user_id"
      AND ur2."club_id" = ur."club_id"
      AND ur2."role" = ur."role"
      AND ur2."id" < ur."id"
  );
--> statement-breakpoint
-- Remove duplicate global role rows (club_id IS NULL; keep smallest id).
DELETE FROM "user_roles" ur
WHERE ur."club_id" IS NULL
  AND EXISTS (
    SELECT 1 FROM "user_roles" ur2
    WHERE ur2."user_id" = ur."user_id"
      AND ur2."club_id" IS NULL
      AND ur2."role" = ur."role"
      AND ur2."id" < ur."id"
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_club_role_unique" ON "user_roles" USING btree ("user_id","club_id","role") WHERE "user_roles"."club_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_role_global_unique" ON "user_roles" USING btree ("user_id","role") WHERE "user_roles"."club_id" is null;