"""SQLite access. Raw sqlite3 on purpose: six queries don't need an ORM,
and plain SQL is easier to explain than a layer that generates it."""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent / "proctoring.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def now():
    """UTC ISO timestamp. Every time in the DB is written by this function."""
    return datetime.now(timezone.utc).isoformat()


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # rows behave like dicts
    return conn


def init_db():
    """Create tables if they don't exist. Safe to run on every startup."""
    with connect() as conn:
        conn.executescript(SCHEMA_PATH.read_text())


# --- writes ---------------------------------------------------------------

def create_applicant_and_session(name, email, role):
    """Intake creates both at once: an applicant always starts a session."""
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO applicants (name, email, role, created_at) VALUES (?, ?, ?, ?)",
            (name, email, role, now()),
        )
        applicant_id = cur.lastrowid
        cur = conn.execute(
            "INSERT INTO sessions (applicant_id, started_at) VALUES (?, ?)",
            (applicant_id, now()),
        )
        return applicant_id, cur.lastrowid


def save_answer(session_id, question_no, text, telemetry):
    """Upsert-ish: re-answering a question (via Back) replaces the old row."""
    with connect() as conn:
        conn.execute(
            "DELETE FROM answers WHERE session_id = ? AND question_no = ?",
            (session_id, question_no),
        )
        conn.execute(
            """INSERT INTO answers
               (session_id, question_no, text, keystrokes, duration_ms,
                max_cps, pasted, saved_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                question_no,
                text,
                telemetry.get("keystrokes", 0),
                telemetry.get("duration_ms", 0),
                telemetry.get("max_cps", 0),
                1 if telemetry.get("pasted") else 0,
                now(),
            ),
        )


def add_event(session_id, type_, duration_ms=0, question_no=None, detail=None):
    """One flagged moment. Written as it happens, not batched at the end,
    so an abandoned session still keeps its evidence."""
    with connect() as conn:
        conn.execute(
            """INSERT INTO events
               (session_id, type, started_at, duration_ms, question_no, detail)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (session_id, type_, now(), duration_ms, question_no, detail),
        )


def end_session(session_id, status="completed"):
    with connect() as conn:
        conn.execute(
            "UPDATE sessions SET ended_at = ?, status = ? WHERE id = ?",
            (now(), status, session_id),
        )


# --- reads ----------------------------------------------------------------

def get_session(session_id):
    """Everything a reviewer needs for one session, in one call."""
    with connect() as conn:
        session = conn.execute(
            """SELECT s.*, a.name, a.email, a.role
               FROM sessions s JOIN applicants a ON a.id = s.applicant_id
               WHERE s.id = ?""",
            (session_id,),
        ).fetchone()
        if session is None:
            return None
        answers = conn.execute(
            "SELECT * FROM answers WHERE session_id = ? ORDER BY question_no",
            (session_id,),
        ).fetchall()
        events = conn.execute(
            "SELECT * FROM events WHERE session_id = ? ORDER BY started_at",
            (session_id,),
        ).fetchall()
        return {
            "session": dict(session),
            "answers": [dict(r) for r in answers],
            "events": [dict(r) for r in events],
        }


def list_sessions():
    with connect() as conn:
        rows = conn.execute(
            """SELECT s.id, s.started_at, s.status, a.name, a.role,
                      (SELECT COUNT(*) FROM events e WHERE e.session_id = s.id) AS event_count
               FROM sessions s JOIN applicants a ON a.id = s.applicant_id
               ORDER BY s.started_at DESC"""
        ).fetchall()
        return [dict(r) for r in rows]
