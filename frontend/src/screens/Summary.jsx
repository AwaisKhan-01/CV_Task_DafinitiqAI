import { useEffect, useState } from "react";
import { getSession } from "../api";

const LABELS = {
  gaze_away: "Looked away",
  no_face: "Left the frame",
  multi_face: "Second face in frame",
  paste: "Pasted answer",
};

function time(iso) {
  return new Date(iso).toLocaleTimeString();
}

// The reviewer's screen. Shows what was observed and how it currently scores,
// and says plainly that this is advice rather than a decision.
export default function Summary({ sessionId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getSession(sessionId).then(setData).catch(() => setError("Could not load the summary."));
  }, [sessionId]);

  if (error) return <div className="card"><p className="error">{error}</p></div>;
  if (!data) return <div className="card"><p>Loading...</p></div>;

  const { session, answers, events, risk } = data;

  return (
    <div className="card">
      <h2>Integrity summary</h2>
      <p className="muted">
        {session.name} &middot; {session.role} &middot; {session.email}
      </p>

      <div className={`band band-${risk.band}`}>
        <strong>{risk.band.toUpperCase()}</strong>
        <span>{risk.reasons.length ? risk.reasons.join(" · ") : "No flags recorded"}</span>
      </div>

      <p className="notice">{risk.note}</p>

      <h3>Flagged moments</h3>
      {events.length === 0 ? (
        <p className="muted">Nothing was flagged during this session.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Signal</th>
              <th>Question</th>
              <th>Lasted</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>{time(e.started_at)}</td>
                <td>{LABELS[e.type] || e.type}</td>
                <td>{e.question_no ? `Q${e.question_no}` : "-"}</td>
                <td>{e.duration_ms ? `${(e.duration_ms / 1000).toFixed(1)}s` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Answers</h3>
      {answers.map((a) => (
        <div key={a.id} className="answer">
          <div className="muted">
            Q{a.question_no}
            {a.pasted ? " · contains pasted text" : ""}
          </div>
          <p>{a.text || <em>No answer given</em>}</p>
        </div>
      ))}
    </div>
  );
}
