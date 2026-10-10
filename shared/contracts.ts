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
}
export type MeetingRsvp = "yes" | "no";
export interface MeetingDetail {
  meeting: Meeting;
  resources: Resource[];
  rsvp: MeetingRsvp | null;
}
export interface Resource {
  id: string;
  meeting_id: string;
  title: string;
  url: string;
}
export interface Settings {
  discord_url?: string;
  club_name: string;
  description: string;
  whatsapp_url: string;
  community_guidelines: string;
}
export interface CommunityAccess extends Settings {
  onboardingRequired: boolean;
  onboardingVersion: string;
  currentBookTitle: string | null;
  nextMeeting: Pick<
    Meeting,
    "title" | "chapters" | "starts_at" | "duration_minutes"
  > | null;
}
export interface Application {
  approval_email_status?: "sending" | "sent" | "failed" | null;
  approval_email_sent_at?: string | null;
  approval_email_error?: string | null;
  id: string;
  email: string;
  name: string;
  experience: string;
  motivation: string;
  status: ApplicationStatus;
  created_at: string;
}
export type PublicMeeting = Pick<
  Meeting,
  "id" | "title" | "chapters" | "starts_at" | "duration_minutes" | "status"
> & { book_title: string };
export interface HomeData {
  memberCount: number;
  nextMeeting: PublicMeeting | null;
  settings: Pick<Settings, "club_name" | "description">;
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
    status: "queued" | "sending" | "sent" | "failed" | "skipped";
    total: number;
  }[];
  rsvps: { meeting_id: string; response: MeetingRsvp; total: number }[];
}
export interface InvitationBatch {
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
}
