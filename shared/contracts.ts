export type ApplicationStatus =
  "pending" | "approved" | "rejected" | "suspended";
export interface Identity {
  userId: string;
  email: string;
  name: string;
  role: "member" | "admin";
  status: ApplicationStatus | null;
  mustChangePassword: boolean;
}
export interface Category {
  id: string;
  name: string;
}
export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  edition: string;
  level: string;
  status: "planned" | "reading" | "completed" | "archived";
  categories: Category[];
}
export interface Cycle {
  id: string;
  book_id: string;
  title: string;
  is_current: number;
}
export interface Meeting {
  id: string;
  cycle_id: string;
  title: string;
  chapters: string;
  starts_at: string | null;
  duration_minutes: number;
  status: "scheduled" | "completed" | "cancelled";
  agenda: string;
  summary: string;
  meeting_url: string;
  updated_at: string;
  book_title?: string;
  book_id?: string;
  youtube_id?: string | null;
  // Comma-separated kinds of the materials attached to the meeting.
  material_kinds?: string | null;
}
export type MeetingRsvp = "yes" | "no";
export interface MeetingDetail {
  meeting: Meeting;
  resources: Resource[];
  rsvp: MeetingRsvp | null;
}
// Every meeting of a book with something published: the recording, the
// summaries, slides and other materials.
export interface BookMaterials {
  book: Pick<Book, "id" | "title" | "author">;
  meetings: (Pick<
    Meeting,
    "id" | "title" | "chapters" | "starts_at" | "youtube_id"
  > & { resources: Resource[] })[];
}
export type ResourceKind =
  "summary_pdf" | "summary_epub" | "slides" | "transcript" | "link";
// What a personal email link may reveal: the meeting announcement and the
// person's own answer. Never the call link, notes or who the person is.
export interface RsvpLink {
  meeting: PublicMeeting;
  rsvp: MeetingRsvp | null;
  open: boolean;
}
export interface Resource {
  id: string;
  meeting_id: string;
  title: string;
  url: string;
  kind: ResourceKind;
}
export interface SocialLinks {
  instagram_url: string;
  linkedin_url: string;
  youtube_url: string;
  x_url: string;
}
export interface Settings extends SocialLinks {
  discord_url?: string;
  club_name: string;
  description: string;
  whatsapp_url: string;
  community_guidelines: string;
}
export interface CommunityAccess extends Settings {
  onboardingRequired: boolean;
  onboardingVersion: string;
  discordAvailable: boolean;
  currentBookTitle: string | null;
  nextMeeting:
    | (Pick<
        Meeting,
        "id" | "title" | "chapters" | "starts_at" | "duration_minutes"
      > & { has_call_link: boolean })
    | null;
}
export interface Application {
  approval_email_status?: "sending" | "sent" | "failed" | null;
  approval_email_sent_at?: string | null;
  approval_email_error?: string | null;
  email_verified_at?: string | null;
  id: string;
  email: string;
  name: string;
  experience: string;
  motivation: string;
  phone: string;
  status: ApplicationStatus;
  created_at: string;
}
// Kept only until the organization removes the person from the groups.
export interface MemberDeparture {
  id: string;
  name: string;
  phone: string;
  left_at: string;
}
export type PublicMeeting = Pick<
  Meeting,
  "id" | "title" | "chapters" | "starts_at" | "duration_minutes" | "status"
> & { book_title: string };
export interface HomeData {
  memberCount: number;
  nextMeeting: PublicMeeting | null;
  settings: Pick<Settings, "club_name" | "description"> & SocialLinks;
  books: Book[];
  currentBook: Book | null;
  turnstileSiteKey: string;
}
export interface AdminData {
  applications: Application[];
  books: Book[];
  cycles: Cycle[];
  meetings: Meeting[];
  categories: Category[];
  resources: Resource[];
  recordings: {
    id: string;
    meeting_id: string;
    youtube_id: string;
    published: number;
  }[];
  settings: Settings;
  invitations: {
    meeting_id: string;
    status: "queued" | "sending" | "sent" | "failed" | "unknown" | "skipped";
    total: number;
  }[];
  rsvps: { meeting_id: string; response: MeetingRsvp; total: number }[];
  departures: MemberDeparture[];
  // Totals only: how many confirmed the introduction and clicked each group.
  communityFunnel: { acknowledged: number; whatsapp: number; discord: number };
}
export interface InvitationQueue {
  added: number;
  queued: number;
}
