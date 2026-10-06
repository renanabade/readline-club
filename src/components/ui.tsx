import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Video,
  BookOpen,
} from "lucide-react";
import type { Book, Meeting } from "../../shared/contracts";
import { dateLabel } from "../lib/dates";
import type { ReactNode } from "react";
export const Arrow = () => <ArrowRight size={18} aria-hidden="true" />;
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="alert">
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      Carregando…
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={26} strokeWidth={1.25} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export const labels = {
  planned: "Na próxima página",
  reading: "Em leitura",
  completed: "Leitura concluída",
  archived: "Arquivado",
  scheduled: "Agendado",
  cancelled: "Cancelado",
};
export function BookArt({
  book,
  compact = false,
}: {
  book: Book;
  compact?: boolean;
}) {
  if (book.id === "entendendo-algoritmos") {
    return (
      <div className={"book-art real-cover " + (compact ? "compact" : "")}>
        <img
          className="book-cover"
          src="/covers/entendendo-algoritmos.png"
          alt={"Capa de " + book.title + ", de " + book.author}
          width={718}
          height={1000}
          decoding="async"
        />
      </div>
    );
  }
  return (
    <div
      className={"book-art " + (compact ? "compact" : "")}
      aria-label={book.title}
    >
      <div className="book-spine" />
      <div className="book-content">
        <span className="book-edition">readline club · Computação</span>
        <strong>{book.title}</strong>
        <span className="book-author">{book.author}</span>
        <svg
          className="book-diagram"
          viewBox="0 0 280 160"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M140 15v34M140 49H55v39M140 49h85v39M55 88H20v44M55 88h35v44M225 88h-35v44M225 88h35v44"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="140" cy="15" r="10" fill="currentColor" />
          <circle cx="55" cy="88" r="10" fill="currentColor" />
          <circle cx="225" cy="88" r="10" fill="currentColor" />
          <rect
            x="10"
            y="131"
            width="20"
            height="20"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="80"
            y="131"
            width="20"
            height="20"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="180"
            y="131"
            width="20"
            height="20"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="250"
            y="131"
            width="20"
            height="20"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        <div className="book-bottom">
          <span>LER. DEBATER. EVOLUIR.</span>
          <BookOpen size={19} />
        </div>
      </div>
    </div>
  );
}
export function BookCard({ book }: { book: Book }) {
  return (
    <Link className="book-card" to={"/livros/" + book.id}>
      <div className="shelf-art">
        <BookArt book={book} compact />
      </div>
      <div className="book-card-body">
        <span className={"tag " + (book.status === "reading" ? "green" : "")}>
          {labels[book.status]}
        </span>
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        <div className="card-foot">
          <span>{book.level}</span>
          <ArrowUpRight size={20} />
        </div>
      </div>
    </Link>
  );
}
export function MeetingRow({ meeting }: { meeting: Meeting }) {
  return (
    <Link className="meeting-row" to={"/encontros/" + meeting.id}>
      <span className="date-icon">
        <CalendarDays size={22} />
      </span>
      <div>
        <span className="muted small">{dateLabel(meeting.starts_at)}</span>
        <h3>{meeting.title}</h3>
        <p>{meeting.chapters || meeting.book_title}</p>
      </div>
      <span className="meeting-status">
        {meeting.youtube_id ? (
          <>
            <Video size={16} />
            Assistir gravação
          </>
        ) : meeting.status === "completed" ? (
          "Realizado"
        ) : (
          labels[meeting.status]
        )}
      </span>
      <ArrowUpRight size={20} />
    </Link>
  );
}
