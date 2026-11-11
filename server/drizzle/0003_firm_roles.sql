ALTER TYPE "public"."user_role" ADD VALUE 'staff';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_firm_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "is_firm_admin" = true WHERE "id" IN (SELECT "owner_id" FROM "offices");
