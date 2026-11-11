-- Keep today's visibility: every existing client goes to the firm's current (non-admin) lawyers and staff.
INSERT INTO "client_assignments" ("client_id", "user_id")
SELECT c."id", u."id"
FROM "clients" c
JOIN "users" u ON u."office_id" = c."office_id"
WHERE u."role" IN ('lawyer', 'staff') AND u."verification_status" = 'verified' AND NOT u."is_firm_admin"
ON CONFLICT DO NOTHING;
