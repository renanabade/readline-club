// Accepting the current guidelines unlocks the group invitations. A new
// version asks everyone to read them again.
export const onboardingVersion = "community-v1";
// Needs the users table aliased as "u".
export const rulesAcceptedSql = `EXISTS (SELECT 1 FROM community_onboarding o WHERE o.user_id=u.id AND o.version='${onboardingVersion}')`;
