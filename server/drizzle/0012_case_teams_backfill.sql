-- Fill the new case team once, copied from the old per-client setup (agreed with Urja, 12 Nov 2026).
-- Main lawyer: the senior lawyer who looked after the client, else the firm founder.
UPDATE "cases" c SET "main_lawyer_id" = COALESCE(
  (SELECT ca."user_id" FROM "client_assignments" ca
     JOIN "users" u ON u."id" = ca."user_id"
    WHERE ca."client_id" = c."client_id" AND u."role" = 'lawyer' AND u."verification_status" = 'verified'
    ORDER BY ca."created_at" LIMIT 1),
  (SELECT o."owner_id" FROM "offices" o WHERE o."id" = c."office_id")
) WHERE c."main_lawyer_id" IS NULL;
--> statement-breakpoint
-- Staff helper: the office staff member who looked after the client.
UPDATE "cases" c SET "helper_staff_id" = (
  SELECT ca."user_id" FROM "client_assignments" ca
    JOIN "users" u ON u."id" = ca."user_id"
   WHERE ca."client_id" = c."client_id" AND u."role" = 'staff' AND u."verification_status" = 'verified'
   ORDER BY ca."created_at" LIMIT 1
) WHERE c."helper_staff_id" IS NULL;
