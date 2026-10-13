import type { Meeting, ResourceKind } from "../../shared/contracts";
export function callLabel(url: string) {
  try {
    const host = new URL(url).hostname;
    if (host === "meet.google.com") return "Entrar no Google Meet";
    if (host === "zoom.us" || host.endsWith(".zoom.us"))
      return "Entrar no Zoom";
  } catch {
    // Falls through to the generic label.
  }
  return "Entrar na chamada";
}
export const materialLabels: Record<ResourceKind, string> = {
  summary_pdf: "Resumo em PDF",
  summary_epub: "Resumo em EPUB",
  slides: "Slides",
  transcript: "Transcrição",
  link: "Material complementar",
};
const shortLabels: Record<ResourceKind, string> = {
  summary_pdf: "PDF",
  summary_epub: "EPUB",
  slides: "Slides",
  transcript: "Transcrição",
  link: "Materiais",
};
export function materialSummary(meeting: Pick<Meeting, "material_kinds">) {
  const kinds = (meeting.material_kinds || "").split(",");
  return (Object.keys(shortLabels) as ResourceKind[])
    .filter((kind) => kinds.includes(kind))
    .map((kind) => shortLabels[kind]);
}
export function durationLabel(minutes: number) {
  if (minutes % 60) return minutes + " minutos";
  const hours = minutes / 60;
  return hours + (hours === 1 ? " hora" : " horas");
}
