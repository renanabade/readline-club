import { useState } from "react";
import { FolderOpen, ChevronDown, Play } from "lucide-react";
import type { Cycle, Meeting } from "../../shared/contracts";
import { Empty, MeetingRow } from "./ui";

export function BookArchive({
  cycles,
  meetings,
}: {
  cycles: Cycle[];
  meetings: Meeting[];
}) {
  const [filter, setFilter] = useState("all");
  const recordings = meetings.filter((meeting) => !!meeting.youtube_id);
  const visible = filter === "recordings" ? recordings : meetings;
  const folders = cycles.filter(
    (cycle) =>
      filter === "all" ||
      visible.some((meeting) => meeting.cycle_id === cycle.id),
  );
  return (
    <section className="section book-archive" aria-labelledby="archive-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Acervo deste livro</span>
          <h2 id="archive-title">Encontros e gravações.</h2>
          <p>Cada ciclo reúne seus encontros, vídeos, notas e materiais.</p>
        </div>
      </div>
      <div className="tabs" aria-label="Filtrar conteúdo do livro">
        <button
          className={filter === "all" ? "active" : ""}
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          Todos os encontros ({meetings.length})
        </button>
        <button
          className={filter === "recordings" ? "active" : ""}
          aria-pressed={filter === "recordings"}
          onClick={() => setFilter("recordings")}
        >
          <Play size={16} /> Gravações ({recordings.length})
        </button>
      </div>
      {filter === "recordings" && !recordings.length ? (
        <Empty title="Ainda não há gravações publicadas.">
          Os vídeos deste livro aparecerão aqui depois que forem publicados pelo
          organizador.
        </Empty>
      ) : folders.length ? (
        folders.map((cycle) => {
          const items = visible.filter(
            (meeting) => meeting.cycle_id === cycle.id,
          );
          const recorded = items.filter(
            (meeting) => !!meeting.youtube_id,
          ).length;
          return (
            <details
              key={cycle.id + filter}
              className="cycle-folder"
              open={cycle.is_current === 1 || folders.length === 1}
              aria-label={cycle.title}
            >
              <summary>
                <FolderOpen size={23} aria-hidden="true" />
                <span className="folder-heading">
                  <strong>{cycle.title}</strong>
                  <span className="muted small">
                    {items.length}{" "}
                    {items.length === 1 ? "encontro" : "encontros"} · {recorded}{" "}
                    {recorded === 1 ? "gravação" : "gravações"}
                  </span>
                </span>
                {cycle.is_current === 1 && (
                  <span className="tag">Leitura atual</span>
                )}
                <ChevronDown
                  className="folder-chevron"
                  size={19}
                  aria-hidden="true"
                />
              </summary>
              <div className="folder-content">
                {items.length ? (
                  items.map((meeting) => (
                    <MeetingRow key={meeting.id} meeting={meeting} />
                  ))
                ) : (
                  <p className="muted">
                    Os encontros deste ciclo ainda serão marcados. As gravações
                    e os materiais ficarão organizados aqui.
                  </p>
                )}
              </div>
            </details>
          );
        })
      ) : (
        <Empty title="Os encontros deste livro ainda serão organizados.">
          Quando o ciclo for criado, você encontrará os encontros e as gravações
          nesta página.
        </Empty>
      )}
    </section>
  );
}
