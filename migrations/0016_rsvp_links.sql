ALTER TABLE meeting_invitations ADD COLUMN rsvp_token_hash TEXT;
CREATE UNIQUE INDEX meeting_invitations_rsvp_token ON meeting_invitations(rsvp_token_hash) WHERE rsvp_token_hash IS NOT NULL;
