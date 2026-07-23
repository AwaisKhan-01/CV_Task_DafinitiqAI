-- Four tables. Applicants and sessions come from intake;
-- answers and events are written during the questionnaire.

CREATE TABLE IF NOT EXISTS applicants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL REFERENCES applicants(id),
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  -- 'in_progress' | 'completed' | 'abandoned' (e.g. camera denied)
  status       TEXT NOT NULL DEFAULT 'in_progress'
);

CREATE TABLE IF NOT EXISTS answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER NOT NULL REFERENCES sessions(id),
  question_no INTEGER NOT NULL,
  text        TEXT NOT NULL,
  -- typing telemetry: how the answer was produced, not just what it says
  keystrokes  INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  max_cps     REAL    NOT NULL DEFAULT 0,   -- fastest sustained burst
  pasted      INTEGER NOT NULL DEFAULT 0,   -- 0/1
  saved_at    TEXT NOT NULL
);

-- One row per flagged moment. Raw observation only: no verdict is stored here.
-- Risk is computed from these rows at display time so a reviewer can always
-- see the evidence independently of how we happen to score it today.
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER NOT NULL REFERENCES sessions(id),
  -- 'gaze_away' | 'no_face' | 'multi_face' | 'paste'
  type        TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,   -- 0 for instantaneous events
  question_no INTEGER,                      -- which question was on screen
  detail      TEXT                          -- short human-readable note
);
