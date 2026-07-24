# Sightline

**A proctoring prototype that produces evidence, not verdicts.**

Sightline takes a job applicant through an intake form and a step-wise
questionnaire while a webcam-based integrity monitor watches for moments worth
a human reviewer's attention. Computer vision runs entirely in the browser —
no video frame ever reaches a server.

**Nothing here auto-rejects anyone.** The output is a list of moments a person
should look at, with an honest account of how reliable each one is.

<!-- TODO: demo GIF here -->
<!-- ![Sightline in use](docs/media/demo.gif) -->

<!-- TODO: live demo link -->
<!-- **[Try the live demo →](https://sightline.example.com)** -->

---

## Quickstart

Two processes. Both must be running.

**Backend**

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn main:app --port 8000
```

**Frontend** (second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open **<http://localhost:5173>** and allow camera access when prompted. The
database (`backend/proctoring.db`) is created on first run.

**Requirements:** Python 3.10+, Node 18+, a webcam, Chromium or Firefox.
No internet connection needed — the CV model is vendored into the repo.

**Inspecting the data**

```bash
curl http://127.0.0.1:8000/sessions      # all sessions
curl http://127.0.0.1:8000/sessions/1    # one session, with events and risk
open http://127.0.0.1:8000/docs          # interactive API docs
```

---

## Stack

| Layer | Choice | Reasoning |
|---|---|---|
| CV | **MediaPipe Face Landmarker, in-browser** | One model provides face count *and* landmarks, covering all three camera signals |
| Frontend | **React + Vite** | The app is genuinely stateful — a stepper carrying live telemetry across screens |
| Backend | **FastAPI** | Seven endpoints, none of which touch a frame |
| Storage | **SQLite via raw `sqlite3`** | Six queries do not need an ORM, and plain SQL is easier to reason about |

### The decision that shaped everything: where CV runs

Analysis happens **in the browser**, not on a Python backend.

- **Privacy by construction.** Video cannot leave the machine, because there is
  no code path that could send it. That is a stronger guarantee than a promise
  not to.
- **Fewer ways to fail live.** A Python CV backend means encoding frames,
  streaming them over a socket 5×/second, and a dependency chain that breaks
  differently on every OS.
- **Shorter path.** The frame is already in memory next to the model.

**The cost, stated plainly:** a candidate who controls the browser can forge
events with DevTools. A production system would move inference server-side,
because the client is adversarial. This prototype targets *casual* integrity
concerns and produces advice rather than decisions, so the cost of defeating it
is low. That is a deliberate trade, not an oversight.

The MediaPipe runtime and model are **vendored into `frontend/public/`** rather
than loaded from a CDN, so the system runs with no network access.

---

## How it works

Every camera signal runs the same five stages:
backend/
main.py 7 endpoints; never receives a frame
db.py 6 queries; the only file touching SQLite
risk.py the only file with an opinion
schema.sql 4 tables
requirements.txt

frontend/src/
App.jsx screen switcher; one state variable, no router
api.js one function per endpoint
thresholds.js every tunable number, with citations
questions.js fixed content
screens/
Intake.jsx form -> session
CameraGate.jsx hard block; distinguishes denied from unavailable
Questionnaire.jsx stepper, telemetry, live indicator
Summary.jsx the reviewer's view
lib/
faceTracker.js MediaPipe -> face count + head pose
debounce.js sustained-state detection
typing.js keystroke and paste telemetry
useCameraMonitor.js the 200ms loop tying it together

docs/
RESEARCH.md sources behind every threshold


---

## AI assistance

Built with AI assistance (Claude Code). Every design decision here is one I can
defend, including the four open bugs above — which were found by writing probe
tests rather than by reading the code.

---

## License

MIT — see [LICENSE](LICENSE).
