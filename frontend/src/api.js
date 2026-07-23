// One function per backend endpoint. No caching, no retries -- if a call
// fails the caller decides what to do.

const BASE = "http://127.0.0.1:8000";

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export const getRoles = () => get("/roles");

export const createApplicant = (name, email, role) =>
  post("/applicants", { name, email, role });

export const saveAnswer = (sessionId, questionNo, text, telemetry) =>
  post("/answers", {
    session_id: sessionId,
    question_no: questionNo,
    text,
    keystrokes: telemetry.keystrokes,
    duration_ms: telemetry.durationMs,
    max_cps: telemetry.maxCps,
    pasted: telemetry.pasted,
  });

// Fire-and-forget: a dropped event must never interrupt the questionnaire.
export const logEvent = (sessionId, type, durationMs, questionNo, detail) =>
  post("/events", {
    session_id: sessionId,
    type,
    duration_ms: Math.round(durationMs || 0),
    question_no: questionNo ?? null,
    detail: detail ?? null,
  }).catch(() => {});

export const endSession = (sessionId, status) =>
  post(`/sessions/${sessionId}/end?status=${status}`, {});

export const getSession = (sessionId) => get(`/sessions/${sessionId}`);
