import type { Meeting, Resource } from "../../shared/contracts";
// Signups get access right away, but the group invitations, recordings,
// materials and meeting emails wait until the email is confirmed. Needs the
// applications table aliased as "a".
export const emailConfirmedSql =
  "NOT (a.email_confirmation_required=1 AND a.email_verified_at IS NULL)";
// Keep the item visible, so the page can ask for the confirmation, but never
// send the video id or the file address.
export const lockRecording = <T extends Pick<Meeting, "youtube_id">>(
  m: T,
): T => ({ ...m, youtube_id: null, recording_locked: !!m.youtube_id });
export const lockResource = <T extends Resource>(r: T): T => ({
  ...r,
  url: "",
  locked: true,
});
