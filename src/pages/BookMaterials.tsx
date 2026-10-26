import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Play } from "lucide-react";
import { useData } from "../lib/useData";
import { dateLabel } from "../lib/dates";
import { materialLabels } from "../lib/meeting";
import { Empty, Loading, Notice } from "../components/ui";
import type { BookMaterials as Materials } from "../../shared/contracts";

// One place to catch up on a book: what each meeting left published, in
// reading order.
export default function BookMaterials() {
  const { id = "" } = useParams();
  const { data, error, loading } = useData<Materials>(
    "/books/" + encodeURIComponent(id) + "/materials",
  );
  if (loading) return <Loading />;
  if (error || !data)
    return (
      <div className="container page">
        <Notice>{error}</Notice>
      </div>
    );
  return (
    <div className="container page book-materials">
      <Link className="back-link" to={"/livros/" + data.book.id}>
        ← {data.book.title}
      </Link>
      <div className="page-heading">
        <span className="eyebrow">Materiais e gravações</span>
        <h1>{data.book.title}</h1>
        <p>
          Resumos em PDF e EPUB, slides e gravações de todos os encontros, por
          capítulo. Para quem chegou no meio do livro ou quer revisar.
        </p>
      </div>
      {data.meetings.length ? (
        data.meetings.map((m) => (
          <section
            key={m.id}
            className="materials-chapter"
            aria-labelledby={"materials-" + m.id}
          >
            <span className="eyebrow">{dateLabel(m.starts_at)}</span>
            <h2 id={"materials-" + m.id}>{m.chapters || m.title}</h2>
            {m.chapters && <p className="muted">{m.title}</p>}
            <ul className="resource-list">
              {m.youtube_id && (
                <li>
                  <Link to={"/encontros/" + m.id}>
                    <span>
                      <span className="resource-kind">Gravação</span>
                      <Play size={14} aria-hidden="true" /> Assistir ao encontro
                    </span>
                    <ArrowUpRight size={16} />
                  </Link>
                </li>
              )}
              {m.resources.map((r) => (
                <li key={r.id}>
                  <a href={r.url} target="_blank" rel="noreferrer">
                    <span>
                      <span className="resource-kind">
                        {materialLabels[r.kind] ?? materialLabels.link}
                      </span>
                      {r.title}
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <Empty title="Ainda não há materiais publicados.">
          Depois de cada encontro, a gravação, o resumo e os slides aparecem
          aqui, organizados por capítulo.
        </Empty>
      )}
    </div>
  );
}
