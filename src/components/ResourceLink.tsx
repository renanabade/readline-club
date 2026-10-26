import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { materialLabels } from "../lib/meeting";
import { LockedButton } from "./EmailGate";
import type { Resource } from "../../shared/contracts";

export function ResourceLink({ resource: r }: { resource: Resource }) {
  const label = (
    <span>
      <span className="resource-kind">
        {materialLabels[r.kind] ?? materialLabels.link}
      </span>
      {r.title}
    </span>
  );
  if (r.locked)
    return (
      <LockedButton className="resource-locked">
        {label}
        <LockKeyhole size={16} aria-label="Confirme seu e-mail para abrir" />
      </LockedButton>
    );
  return (
    <a href={r.url} target="_blank" rel="noreferrer">
      {label}
      <ArrowUpRight size={16} />
    </a>
  );
}
