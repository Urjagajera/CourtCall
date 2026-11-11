CREATE TYPE "public"."case_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."hearing_outcome" AS ENUM('next_date', 'closed');--> statement-breakpoint
CREATE TABLE "case_hearings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"date" date NOT NULL,
	"courtroom_id" uuid NOT NULL,
	"item_no" integer,
	"outcome" "hearing_outcome" NOT NULL,
	"next_date" date,
	"summary" text,
	"share_with_client" boolean DEFAULT false NOT NULL,
	"prep_notes" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "item_no" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "status" "case_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "case_hearings" ADD CONSTRAINT "case_hearings_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_hearings" ADD CONSTRAINT "case_hearings_courtroom_id_courtrooms_id_fk" FOREIGN KEY ("courtroom_id") REFERENCES "public"."courtrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_hearings" ADD CONSTRAINT "case_hearings_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_hearings_case_date_uq" ON "case_hearings" USING btree ("case_id","date");