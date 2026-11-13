ALTER TABLE "offices" ADD COLUMN "stale_minutes" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "phone_country_code" text DEFAULT '91' NOT NULL;