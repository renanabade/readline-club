// Scheduled and not over yet: the same rule the agenda applies with
// isUpcoming (src/lib/dates.ts), so every "next meeting" agrees with it.
// Lives outside routes/ so the mailer can use it without bundling Hono.
export const nextMeetingWhere =
  "m.status='scheduled' AND m.starts_at IS NOT NULL AND b.status!='archived' AND strftime('%Y-%m-%dT%H:%M:%fZ',m.starts_at,'+'||m.duration_minutes||' minutes')>?";
