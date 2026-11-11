-- Only senior lawyers can be firm admins: clear the flag on any junior or office staff member.
-- (The app already ignores it for them; this keeps the data consistent.)
UPDATE "users" SET "is_firm_admin" = false WHERE "is_firm_admin" = true AND "role" <> 'lawyer';
