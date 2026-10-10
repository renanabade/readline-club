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
export const signupSchema = z.object({
  name: short,
  email: emailSchema,
  password: passwordSchema,
  experience: z.enum(["beginner", "learning", "experienced"]),
  motivation: z.string().trim().max(2000).default(""),
  consent: z.literal(true),
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
});
export const rsvpSchema = z.object({
  response: z.enum(["yes", "no"], "Escolha se vai participar."),
});
export const preferencesSchema = z.object({ meetingEmails: z.boolean() });
