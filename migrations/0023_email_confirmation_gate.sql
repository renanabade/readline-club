-- Signups get access right away. Until the email is confirmed, the group
-- invitations, recordings, materials and meeting emails stay locked.
-- Accounts created before this change keep their access as it is.
ALTER TABLE applications ADD COLUMN email_confirmation_required INTEGER NOT NULL DEFAULT 0 CHECK(email_confirmation_required IN (0,1));
UPDATE applications SET status='approved',email_confirmation_required=1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE status='pending' AND email_verified_at IS NULL AND email IN (SELECT email FROM users WHERE role='member');
