"""FastAPI app. Deliberately dumb: it stores rows and reads them back.

It runs no models and never receives a video frame or an image. All camera
analysis happens in the browser, so raw video cannot leave the candidate's
machine -- that is an architectural guarantee, not a policy promise.
"""

import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import risk

app = FastAPI(title="Proctored Application & CV Integrity System")

# Vite dev server. Local-only prototype.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ROLES = ["Software Engineer", "Designer", "DevOps", "Data Scientist", "Product Manager"]


@app.on_event("startup")
def startup():
    db.init_db()


# --- request bodies -------------------------------------------------------

class Applicant(BaseModel):
    name: str
    email: str
    role: str


class Answer(BaseModel):
    session_id: int
    question_no: int
    text: str
    keystrokes: int = 0
    duration_ms: int = 0
    max_cps: float = 0
    pasted: bool = False


class Event(BaseModel):
    session_id: int
    type: str
    duration_ms: int = 0
    question_no: int | None = None
    detail: str | None = None


# --- endpoints ------------------------------------------------------------

@app.get("/roles")
def roles():
    return ROLES


@app.post("/applicants")
def create_applicant(a: Applicant):
    """Intake. Validation is repeated here rather than trusted from the client."""
    if not a.name.strip():
        raise HTTPException(400, "Name is required")
    if not EMAIL_RE.match(a.email.strip()):
        raise HTTPException(400, "A valid email is required")
    if a.role not in ROLES:
        raise HTTPException(400, "Please choose a role")

    applicant_id, session_id = db.create_applicant_and_session(
        a.name.strip(), a.email.strip(), a.role
    )
    return {"applicant_id": applicant_id, "session_id": session_id}


@app.post("/answers")
def save_answer(a: Answer):
    db.save_answer(
        a.session_id,
        a.question_no,
        a.text,
        {
            "keystrokes": a.keystrokes,
            "duration_ms": a.duration_ms,
            "max_cps": a.max_cps,
            "pasted": a.pasted,
        },
    )
    return {"ok": True}


@app.post("/events")
def add_event(e: Event):
    """One flagged moment, posted as it happens."""
    if e.type not in risk.WEIGHTS:
        raise HTTPException(400, f"Unknown event type: {e.type}")
    db.add_event(e.session_id, e.type, e.duration_ms, e.question_no, e.detail)
    return {"ok": True}


@app.post("/sessions/{session_id}/end")
def end_session(session_id: int, status: str = "completed"):
    if status not in ("completed", "abandoned"):
        raise HTTPException(400, "Invalid status")
    db.end_session(session_id, status)
    return {"ok": True}


@app.get("/sessions")
def list_sessions():
    return db.list_sessions()


@app.get("/sessions/{session_id}")
def get_session(session_id: int):
    """The reviewer's view: applicant, answers, events, and today's risk read."""
    data = db.get_session(session_id)
    if data is None:
        raise HTTPException(404, "Session not found")
    data["risk"] = risk.assess(data["events"])
    return data
