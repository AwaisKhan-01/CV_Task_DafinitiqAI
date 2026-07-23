import { useState } from "react";
import { QUESTIONS } from "../questions";
import { endSession, saveAnswer } from "../api";

// Step-wise questionnaire. One question on screen at a time.
// NOTE: camera signals and typing telemetry are added in the next step --
// for now this is the stepper and persistence only.
export default function Questionnaire({ sessionId, stream, onDone }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => QUESTIONS.map(() => ""));
  const [busy, setBusy] = useState(false);

  const isLast = index === QUESTIONS.length - 1;

  function setAnswer(text) {
    const next = [...answers];
    next[index] = text;
    setAnswers(next);
  }

  async function next() {
    setBusy(true);
    await saveAnswer(sessionId, index + 1, answers[index], {
      keystrokes: 0,
      durationMs: 0,
      maxCps: 0,
      pasted: false,
    }).catch(() => {});

    if (isLast) {
      await endSession(sessionId, "completed").catch(() => {});
      stream?.getTracks().forEach((t) => t.stop());
      onDone();
    } else {
      setIndex(index + 1);
    }
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="progress">
        Question {index + 1} of {QUESTIONS.length}
      </div>

      <h2>{QUESTIONS[index]}</h2>

      <textarea
        rows={7}
        value={answers[index]}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer here..."
      />

      <div className="row">
        <button
          onClick={() => setIndex(index - 1)}
          disabled={index === 0 || busy}
        >
          Back
        </button>
        <button onClick={next} disabled={busy}>
          {isLast ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
