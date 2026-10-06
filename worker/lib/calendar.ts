import type { Meeting } from "../../shared/contracts";
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
const stamp = (s: string | number) =>
  new Date(s)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
function fold(s: string) {
  let out = "",
    line = "",
    bytes = 0;
  for (const ch of s) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > 74) {
      out += line + "\r\n";
      line = " ";
      bytes = 1;
    }
    line += ch;
    bytes += n;
  }
  return out + line;
}
export function meetingToIcs(m: Meeting): string {
  if (!m.starts_at) throw new Error("Encontro sem data.");
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Clube do Livro//Encontros//PT",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + m.id + "@clube-do-livro",
      "DTSTAMP:" + stamp(m.updated_at),
      "DTSTART:" + stamp(m.starts_at),
      "DTEND:" + stamp(Date.parse(m.starts_at) + m.duration_minutes * 60000),
      "SUMMARY:" + escape(m.title),
      "DESCRIPTION:" + escape(m.chapters),
      "STATUS:" + (m.status === "cancelled" ? "CANCELLED" : "CONFIRMED"),
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
