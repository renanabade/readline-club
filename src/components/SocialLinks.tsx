import { ArrowUpRight } from "lucide-react";
import { useSession } from "../lib/session";
import type { SocialLinks as Links } from "../../shared/contracts";
const networks: [keyof Links, string][] = [
  ["instagram_url", "Instagram"],
  ["linkedin_url", "LinkedIn"],
  ["youtube_url", "YouTube"],
  ["tiktok_url", "TikTok"],
];
export function SocialLinks({ title }: { title?: string }) {
  const settings = useSession().home?.settings;
  const links = networks.filter(([key]) => settings?.[key]);
  if (!settings || !links.length) return null;
  return (
    <nav className="social-links" aria-label="Redes sociais do clube">
      {title && <span>{title}</span>}
      {links.map(([key, label]) => (
        <a
          key={key}
          href={settings[key]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {label} <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}
