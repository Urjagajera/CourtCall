CREATE TYPE "public"."event_type" AS ENUM('now_hearing', 'passed_over', 'recalled', 'adjourned', 'break_start', 'break_end', 'court_not_sitting', 'court_risen', 'correction');--> statement-breakpoint
CREATE TYPE "public"."link_kind" AS ENUM('client', 'family');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('not_started', 'hearing', 'break', 'risen', 'not_sitting');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('lawyer', 'junior', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "access_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" "link_kind" DEFAULT 'client' NOT NULL,
	"label" text,
	"token_hash" text NOT NULL,
	"device_id_hash" text,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "alert_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"event_version" integer NOT NULL,
	"alert_key" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_once" UNIQUE("case_id","session_id","alert_key")
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"case_no" text,
	"courtroom_id" uuid NOT NULL,
	"hearing_date" date NOT NULL,
	"item_no" integer NOT NULL,
	"assigned_junior_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "court_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"type" "event_type" NOT NULL,
	"item" integer,
	"reporter_id" uuid NOT NULL,
	"office_id" uuid,
	"single_reporter" boolean DEFAULT false NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"corrects_event_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_session_version" UNIQUE("session_id","version")
);
--> statement-breakpoint
CREATE TABLE "court_session_members" (
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reported_at" timestamp with time zone,
	CONSTRAINT "court_session_members_session_id_user_id_pk" PRIMARY KEY("session_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "court_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"courtroom_id" uuid NOT NULL,
	"date" date NOT NULL,
	"current_item" integer,
	"status" "session_status" DEFAULT 'not_started' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"last_event_at" timestamp with time zone,
	"nexconn_group_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_courtroom_date" UNIQUE("courtroom_id","date")
);
--> statement-breakpoint
CREATE TABLE "courtrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"court_complex" text NOT NULL,
	"room_no" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courtroom_complex_room" UNIQUE("court_complex","room_no")
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"invite_code" text NOT NULL,
	"nexconn_team_group_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offices_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"access_link_id" uuid,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"bar_council_no" text,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"office_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_logs" ADD CONSTRAINT "alert_logs_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_logs" ADD CONSTRAINT "alert_logs_session_id_court_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."court_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_courtroom_id_courtrooms_id_fk" FOREIGN KEY ("courtroom_id") REFERENCES "public"."courtrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_junior_id_users_id_fk" FOREIGN KEY ("assigned_junior_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_events" ADD CONSTRAINT "court_events_session_id_court_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."court_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_events" ADD CONSTRAINT "court_events_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_events" ADD CONSTRAINT "court_events_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_events" ADD CONSTRAINT "court_events_corrects_event_id_court_events_id_fk" FOREIGN KEY ("corrects_event_id") REFERENCES "public"."court_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_session_members" ADD CONSTRAINT "court_session_members_session_id_court_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."court_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_session_members" ADD CONSTRAINT "court_session_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_sessions" ADD CONSTRAINT "court_sessions_courtroom_id_courtrooms_id_fk" FOREIGN KEY ("courtroom_id") REFERENCES "public"."courtrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_access_link_id_access_links_id_fk" FOREIGN KEY ("access_link_id") REFERENCES "public"."access_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cases_office_idx" ON "cases" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "cases_courtroom_date_idx" ON "cases" USING btree ("courtroom_id","hearing_date");--> statement-breakpoint
CREATE INDEX "clients_office_idx" ON "clients" USING btree ("office_id");