ALTER TABLE "cases" ADD COLUMN "appearing_lawyer_id" uuid;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "remember_note" text;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_appearing_lawyer_id_users_id_fk" FOREIGN KEY ("appearing_lawyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;