import { useEffect, useRef, useState } from "react";
import { QUESTIONS } from "../questions";
import { endSession, logEvent, saveAnswer } from "../api";
import { createTypingTracker } from "../lib/typing";
import { useCameraMonitor } from "../lib/useCameraMonitor";

const STATUS_TEXT = {
  starting: "Starting camera checks...",
  ok: "Camera active",
  away: "Looking away from screen",
  no_face: "No face detected",
  multi_face: "More than one person visible",
  model_failed: "Monitoring unavailable",
};

export default function Questionnaire({ sessionId, stream, onDone }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => QUESTIONS.map(() => ""));
  const [busy, setBusy] = useState(false);

  const videoRef = useRef(null);

  // The camera loop needs the current question number, but must not restart
  // every time it changes -- so it reads it from a ref.
  const questionRef = useRef(1);
  useEffect(() => {
    questionRef.current = index + 1;
  }, [index]);

  // One tracker per question, kept across renders.
  const typingRef = useRef(createTypingTracker());

  const { status } = useCameraMonitor({ sessionId, videoRef, questionRef });

  // Attach the stream opened at the camera gate.
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const isLast = index === QUESTIONS.length - 1;

  function setAnswer(text) {
    typingRef.current.onChange(text);
    const next = [...answers];
    next[index] = text;
    setAnswers(next);
  }

  async function move(nextIndex) {
    setBusy(true);
    const telemetry = typingRef.current.summary();

    await saveAnswer(sessionId, index + 1, answers[index], telemetry).catch(() => {});

    // Paste is a discrete moment, not a sustained state, so it is logged here
    // rather than through the debounce path used by the camera signals.
    if (telemetry.pasted) {
      const chars = telemetry.flags.reduce((n, f) => n + f.chars, 0);
      const kinds = [...new Set(telemetry.flags.map((f) => f.kind))].join(", ");
      await logEvent(sessionId, "paste", 0, index + 1, `${kinds} (${chars} chars)`);
    }

    if (nextIndex === null) {
      await endSession(sessionId, "completed").catch(() => {});
      stream?.getTracks().forEach((t) => t.stop());
      onDone();
      return;
    }

    // Returning to an existing answer: seed the tracker so pre-existing text
    // is not counted as a bulk insert.
    typingRef.current.reset();
    typingRef.current.seed(answers[nextIndex]);
    setIndex(nextIndex);
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="monitor">
        <video ref={videoRef} autoPlay playsInline muted className="thumb" />
        <span className={`chip chip-${status === "ok" ? "ok" : "warn"}`}>
          {STATUS_TEXT[status]}
        </span>
      </div>

      <div className="progress">
        Question {index + 1} of {QUESTIONS.length}
      </div>

      <h2>{QUESTIONS[index]}</h2>

      <textarea
        rows={7}
        value={answers[index]}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={() => typingRef.current.onKeyDown()}
        onPaste={(e) => typingRef.current.onPaste(e.clipboardData.getData("text"))}
        placeholder="Type your answer here..."
      />

      <div className="row">
        <button onClick={() => move(index - 1)} disabled={index === 0 || busy}>
          Back
        </button>
        <button onClick={() => move(isLast ? null : index + 1)} disabled={busy}>
          {isLast ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
