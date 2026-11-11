-- Firm founders no longer wait for a CourtCall admin check: approve any who were still pending.
UPDATE "users" SET "verification_status" = 'verified' WHERE "verification_status" = 'pending' AND "id" IN (SELECT "owner_id" FROM "offices");
