import { z } from "zod";
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(10, "Use pelo menos 10 caracteres.")
  .max(128);
const short = z.string().trim().min(1).max(200);
const text = z.string().trim().max(12000);
export const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Use um link HTTPS válido.");
// Stored as +<country><number>. Numbers typed without a country code are
// taken as Brazilian, the club's audience.
export const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .transform((value) => {
    const digits = value.replace(/\D/g, "");
    return !value.startsWith("+") && [10, 11].includes(digits.length)
      ? "55" + digits
      : digits;
  })
  .refine(
    (digits) => digits.length >= 10 && digits.length <= 15,
    "Informe um celular com DDD, como (11) 91234-5678.",
  )
  .transform((digits) => "+" + digits);
// Social profiles are public: only links to the expected networks.
const socialUrl = (hosts: string[], network: string) =>
  httpsUrl
    .refine(
      (v) => {
        if (!v) return true;
        try {
          const host = new URL(v).hostname;
          return hosts.some((h) => host === h || host.endsWith("." + h));
        } catch {
          return false;
        }
      },
      "Use um link do " + network + ".",
    )
    .default("");
export const signupSchema = z.object({
  name: short,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  experience: z.enum(["beginner", "learning", "experienced"]),
  motivation: z.string().trim().max(2000).default(""),
  consent: z.literal(true),
  turnstileToken: z.string().max(2048).default(""),
});
export const forgotPasswordSchema = z.object({
  email: emailSchema,
  turnstileToken: z.string().max(2048).default(""),
});
export const bookSchema = z.object({
  title: short,
  author: short,
  description: text.default(""),
  edition: z.string().trim().max(200).default(""),
  level: z.string().trim().max(100).default("Iniciante"),
  status: z
    .enum(["planned", "reading", "completed", "archived"])
    .default("planned"),
  category_ids: z.array(z.string().max(100)).max(20).default([]),
});
export const cycleSchema = z.object({
  book_id: short,
  title: short,
  is_current: z.coerce.number().int().min(0).max(1).default(0),
});
export const meetingSchema = z.object({
  cycle_id: short,
  title: short,
  chapters: z.string().trim().max(500).default(""),
  starts_at: z.string().datetime({ offset: true }).nullable().default(null),
  duration_minutes: z.coerce.number().int().min(15).max(480).default(60),
  status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
  agenda: text.default(""),
  summary: text.default(""),
  meeting_url: httpsUrl.default(""),
});
// Partial updates: every field optional and without its default, so a field
// left out of the body is left out of the result instead of reset.
export function patchSchema(schema: z.ZodObject) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      (field instanceof z.ZodDefault
        ? field.removeDefault()
        : field
      ).optional(),
    ]),
  );
  return z
    .object(shape)
    .refine((data) => Object.keys(data).length > 0, "Envie ao menos um campo.");
}
export const settingsSchema = z.object({
  club_name: short,
  description: z.string().trim().min(1).max(1000),
  whatsapp_url: httpsUrl
    .refine((v) => {
      if (!v) return true;
      try {
        return ["chat.whatsapp.com", "wa.me", "api.whatsapp.com"].includes(
          new URL(v).hostname,
        );
      } catch {
        return false;
      }
    }, "Use um link do WhatsApp.")
    .default(""),
  discord_url: httpsUrl
    .refine((v) => {
      if (!v) return true;
      try {
        return ["discord.gg", "discord.com"].includes(new URL(v).hostname);
      } catch {
        return false;
      }
    }, "Use um link do Discord.")
    .default(""),
  community_guidelines: text.default(""),
  instagram_url: socialUrl(["instagram.com"], "Instagram"),
  linkedin_url: socialUrl(["linkedin.com"], "LinkedIn"),
  youtube_url: socialUrl(["youtube.com", "youtu.be"], "YouTube"),
  x_url: socialUrl(["x.com", "twitter.com"], "X"),
});
export const rsvpSchema = z.object({
  response: z.enum(["yes", "no"], "Escolha se vai participar."),
});
const rsvpToken = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "Este link de confirmação está incompleto.");
export const rsvpLinkSchema = z.object({ token: rsvpToken });
export const rsvpLinkAnswerSchema = rsvpSchema.extend({ token: rsvpToken });
export const preferencesSchema = z.object({ meetingEmails: z.boolean() });
export const groupClickSchema = z.object({
  channel: z.enum(["whatsapp", "discord"], "Escolha o grupo."),
});
export const profileSchema = z.object({ phone: phoneSchema });
export const resourceKinds = [
  "summary_pdf",
  "summary_epub",
  "slides",
  "transcript",
  "link",
] as const;
export const maxQuestionsPerMeeting = 3;
export const questionSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Escreva a pergunta.")
    .max(500, "Use até 500 caracteres."),
});
export const questionVoteSchema = z.object({ vote: z.boolean() });
export const questionReviewSchema = z
  .object({ hidden: z.boolean().optional(), agenda: z.boolean().optional() })
  .refine(
    (data) => data.hidden !== undefined || data.agenda !== undefined,
    "Envie ao menos um campo.",
  );
