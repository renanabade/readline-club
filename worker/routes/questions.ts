import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { input, missing } from "../errors";
import { rateLimit } from "../auth/limits";
import {
  maxQuestionsPerMeeting,
  questionReviewSchema,
  questionSchema,
  questionVoteSchema,
} from "../../shared/validation";
import type { AdminQuestion, MeetingQuestion } from "../../shared/contracts";
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Membro";
async function memberMeeting(c: Context<AppEnv>) {
  const meeting = await c.env.DB.prepare(
    "SELECT m.id,m.status,m.starts_at FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id WHERE m.id=? AND b.status!='archived'",
  )
    .bind(c.req.param("id"))
    .first<{ id: string; status: string; starts_at: string | null }>();
  if (!meeting) return null;
  // Questions and votes are for preparing the conversation: they close when
  // the meeting starts.
  const open =
    meeting.status === "scheduled" &&
    !!meeting.starts_at &&
    Date.parse(meeting.starts_at) > Date.now();
  return { id: meeting.id, open };
}
const closed = () =>
  new HTTPException(409, {
    message: "As perguntas deste encontro estão encerradas.",
  });
async function memberQuestions(
  c: Context<AppEnv>,
  meetingId: string,
  userId: string,
): Promise<MeetingQuestion[]> {
  const rows = await c.env.DB.prepare(
    `SELECT q.id,q.body,u.name,q.agenda,q.created_at,q.user_id=?2 mine,
    (SELECT COUNT(*) FROM meeting_question_votes v WHERE v.question_id=q.id) votes,
    EXISTS(SELECT 1 FROM meeting_question_votes v WHERE v.question_id=q.id AND v.user_id=?2) voted
    FROM meeting_questions q JOIN users u ON u.id=q.user_id
    WHERE q.meeting_id=?1 AND q.hidden=0
    ORDER BY q.agenda DESC,votes DESC,q.created_at,q.id`,
  )
    .bind(meetingId, userId)
    .all<{
      id: string;
      body: string;
      name: string;
      agenda: number;
      created_at: string;
      mine: number;
      votes: number;
      voted: number;
    }>();
  return rows.results.map((q) => ({
    id: q.id,
    body: q.body,
    first_name: firstName(q.name),
    votes: q.votes,
    voted: q.voted === 1,
    mine: q.mine === 1,
    agenda: q.agenda === 1,
    created_at: q.created_at,
  }));
}
const questions = new Hono<AppEnv>();
questions.get("/meetings/:id/questions", async (c) => {
  const meeting = await memberMeeting(c);
  if (!meeting) return missing();
  const { userId } = c.get("identity");
  // Hidden questions still count, so hiding one does not free a slot.
  const sent = await c.env.DB.prepare(
    "SELECT COUNT(*) total FROM meeting_questions WHERE meeting_id=? AND user_id=?",
  )
    .bind(meeting.id, userId)
    .first<number>("total");
  return c.json({
    open: meeting.open,
    remaining: Math.max(0, maxQuestionsPerMeeting - (sent ?? 0)),
    questions: await memberQuestions(c, meeting.id, userId),
  });
});
questions.post("/meetings/:id/questions", async (c) => {
  const { body } = await input(c, questionSchema);
  const meeting = await memberMeeting(c);
  if (!meeting) return missing();
  if (!meeting.open) throw closed();
  const { userId } = c.get("identity");
  await rateLimit(c, "question", 10, userId);
  const id = crypto.randomUUID();
  // The limit is checked in the same statement, so parallel requests cannot
  // go past it.
  const row = await c.env.DB.prepare(
    `INSERT INTO meeting_questions(id,meeting_id,user_id,body,created_at)
    SELECT ?1,?2,?3,?4,?5 WHERE (SELECT COUNT(*) FROM meeting_questions WHERE meeting_id=?2 AND user_id=?3)<?6
    RETURNING id`,
  )
    .bind(
      id,
      meeting.id,
      userId,
      body,
      new Date().toISOString(),
      maxQuestionsPerMeeting,
    )
    .first();
  if (!row)
    throw new HTTPException(409, {
      message: `Você já enviou ${maxQuestionsPerMeeting} perguntas para este encontro.`,
    });
  return c.json({ id }, 201);
});
questions.delete("/meetings/:id/questions/:question", async (c) => {
  const row = await c.env.DB.prepare(
    "DELETE FROM meeting_questions WHERE id=? AND meeting_id=? AND user_id=? RETURNING id",
  )
    .bind(c.req.param("question"), c.req.param("id"), c.get("identity").userId)
    .first();
  if (!row) return missing();
  return c.json({ ok: true });
});
questions.put("/meetings/:id/questions/:question/vote", async (c) => {
  const { vote } = await input(c, questionVoteSchema);
  const meeting = await memberMeeting(c);
  if (!meeting) return missing();
  if (!meeting.open) throw closed();
  const { userId } = c.get("identity");
  const question = await c.env.DB.prepare(
    "SELECT id,user_id FROM meeting_questions WHERE id=? AND meeting_id=? AND hidden=0",
  )
    .bind(c.req.param("question"), meeting.id)
    .first<{ id: string; user_id: string }>();
  if (!question) return missing();
  if (question.user_id === userId)
    throw new HTTPException(409, {
      message: "Esta pergunta é sua: ela já está na lista.",
    });
  await rateLimit(c, "question-vote", 60, userId);
  await c.env.DB.prepare(
    vote
      ? "INSERT INTO meeting_question_votes(question_id,user_id,created_at) VALUES(?,?,?) ON CONFLICT(question_id,user_id) DO NOTHING"
      : "DELETE FROM meeting_question_votes WHERE question_id=? AND user_id=?",
  )
    .bind(question.id, userId, ...(vote ? [new Date().toISOString()] : []))
    .run();
  const votes = await c.env.DB.prepare(
    "SELECT COUNT(*) total FROM meeting_question_votes WHERE question_id=?",
  )
    .bind(question.id)
    .first<number>("total");
  return c.json({ voted: vote, votes: votes ?? 0 });
});
const questionsAdmin = new Hono<AppEnv>();
questionsAdmin.get("/meetings/:id/questions", async (c) => {
  const meeting = await c.env.DB.prepare("SELECT id FROM meetings WHERE id=?")
    .bind(c.req.param("id"))
    .first<{ id: string }>();
  if (!meeting) return missing();
  const rows = await c.env.DB.prepare(
    `SELECT q.id,q.body,u.name author,q.hidden,q.agenda,q.created_at,
    (SELECT COUNT(*) FROM meeting_question_votes v WHERE v.question_id=q.id) votes
    FROM meeting_questions q JOIN users u ON u.id=q.user_id
    WHERE q.meeting_id=? ORDER BY q.created_at,q.id`,
  )
    .bind(meeting.id)
    .all<
      Omit<AdminQuestion, "hidden" | "agenda"> & {
        hidden: number;
        agenda: number;
      }
    >();
  return c.json(
    rows.results.map((q) => ({
      ...q,
      hidden: q.hidden === 1,
      agenda: q.agenda === 1,
    })),
  );
});
questionsAdmin.patch("/questions/:question", async (c) => {
  const { hidden, agenda } = await input(c, questionReviewSchema);
  const row = await c.env.DB.prepare(
    "UPDATE meeting_questions SET hidden=COALESCE(?,hidden),agenda=COALESCE(?,agenda) WHERE id=? RETURNING id",
  )
    .bind(
      hidden === undefined ? null : Number(hidden),
      agenda === undefined ? null : Number(agenda),
      c.req.param("question"),
    )
    .first();
  if (!row) return missing();
  return c.json({ ok: true });
});
export { questions, questionsAdmin };
