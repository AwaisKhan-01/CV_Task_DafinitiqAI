# Proctored Application & CV Integrity System

A locally-running prototype that takes a job applicant through an intake form
and a step-wise questionnaire while a webcam-based integrity monitor watches
for signs worth a human reviewer's attention.

**Nothing here auto-rejects anyone.** The output is a list of moments a person
should look at, with an honest account of how reliable each one is.

---

## Running it

Two processes. Both must be running.

### 1 · Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn main:app --port 8000
```

### 2 · Frontend (second terminal)

```bash
cd frontend
npm install
npm run dev
```

### 3 · Open it

**http://localhost:5173**

Allow camera access when prompted. The database (`backend/proctoring.db`) is
created automatically on first run.

**Requirements:** Python 3.10+, Node 18+, a webcam, and a Chromium or Firefox
browser. No internet connection is needed — the CV model is vendored into the
repository.

### Inspecting the data

```bash
# All sessions
curl http://127.0.0.1:8000/sessions

# One session with answers, events and risk assessment
curl http://127.0.0.1:8000/sessions/1

# Or browse the interactive API docs
open http://127.0.0.1:8000/docs
```

---

## Stack, and why

| Layer | Choice | Reasoning |
|---|---|---|
| CV | **MediaPipe Face Landmarker, in-browser** | One model provides face count *and* landmarks, covering all three camera signals |
| Frontend | **React + Vite, plain JavaScript** | The app is genuinely stateful. Types were dropped to fit the time box |
| Backend | **FastAPI** | ~15 lines for the endpoints needed; the natural choice for the role |
| Storage | **SQLite via raw `sqlite3`** | Six queries do not need an ORM, and plain SQL is easier to defend |

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
events with DevTools. For a production system you would move inference
server-side, because the client is adversarial. This prototype targets *casual*
integrity concerns and produces advice rather than decisions, so the cost of
defeating it is low. That is a deliberate trade, not an oversight.

The MediaPipe runtime and model are **vendored into `frontend/public/`** rather
than loaded from a CDN, so the system runs with no network access.

---

## How it works

Every camera signal runs the same five stages:

```
sample   →   measure    →   compare    →   sustain   →   emit
200ms       faceTracker    thresholds     debounce      api
```

Stages 1–3 run five times a second. Stage 5 runs rarely. **A ten-second
look-away is 55 measurements that become one database row.** That compression
is the point of the system.

Each stage lives in its own module and knows nothing about the others:
`faceTracker.js` reports facts and has no idea what "away" means;
`debounce.js` has no idea what it is debouncing. That is precisely why the
same forty lines serve all three camera signals.

### Debouncing

The rule is a stopwatch, not a tripwire — not *"is it true now"* but *"how long
has it been true"*. Three properties matter:

- **Asymmetric.** 6 s to open an event, 1 s of calm to close it. Without the
  recovery window, one continuous look-away interrupted by a single dropped
  frame would be recorded as two separate events.
- **Backdated.** Duration measures from when the condition actually began, not
  from when we decided to believe it. Otherwise every duration is short by the
  sustain period.
- **Flushed.** An event still open when the session ends is still recorded.

Ten unit tests cover this, including *"a 3.9 s aversion produces no event"* and
*"one dropped frame does not split an event"*.

---

## What each signal actually measures

### Gaze / attention — *head orientation, not eye gaze*

MediaPipe returns 468 facial landmarks. Five are used. Yaw comes from comparing
the nose's horizontal distance to each eye — equal when facing forward, skewed
when turned. Pitch comes from the nose's vertical position between forehead and
chin.

Estimated geometrically rather than with `solvePnP`, which would need camera
calibration and a 3D reference model. This needs neither and can be debugged
live.

**It measures where the head points, not where the eyes look.** Someone can
face the camera and read a second monitor with their eyes alone. The `* 60`
degree scaling is empirical — a monotonic proxy rather than a calibrated angle.

**False positives:** people who think while looking away (see the threshold
section); anyone whose posture or seating puts them at an angle; a
badly-positioned webcam.

### Presence — *face count, nothing more*

Zero faces for a sustained period means the candidate left the frame. Two or
more means someone else is visible.

**False positives:** poor or backlit lighting; a face on a poster, screen or
reflection behind the candidate; darker skin tones under weak lighting, where
detection is measurably less reliable.

### Paste vs. typing — *the most reliable signal, and not computer vision*

Two independent detectors:

1. **The browser's `paste` event** — unambiguous, near-zero false positives,
   but blind to autofill, drag-and-drop and programmatic input.
2. **A bulk-insert check** — the text grew far more than the keystroke count
   explains. Catches what the first misses.

Plus a sustained characters-per-second ceiling.

**False positives:** anyone who drafts an answer in another editor and pastes
it in. That is not misconduct, which is exactly why it is a flag rather than a
verdict.

---

## Thresholds

Every number lives in `frontend/src/thresholds.js` with its justification in a
comment beside it. They are derived from published behavioural research, not
guessed. Full derivations and sources: **[docs/RESEARCH.md](docs/RESEARCH.md)**.

| Constant | Value | Derived from |
|---|---|---|
| `GAZE_AWAY_SUSTAIN_MS` | 6000 | Median innocent gaze aversion during recall is ~3.9 s |
| `NO_FACE_SUSTAIN_MS` | 3000 | ~23× the 129 ms mean blink; longest observed blink is 347 ms |
| `MULTI_FACE_SUSTAIN_MS` | 2000 | Shorter — stronger signal, but detectors misfire for single frames |
| `RECOVERY_MS` | 1000 | ~2× the 500 ms window used in the source study to exclude blinks |
| `MAX_PLAUSIBLE_CPS` | 12 | Above ~10 cps (120 WPM), the maximum across 168,000 people |

**The gaze threshold changed during the build.** It began at 3 s. Eye-tracking
research then showed that 30 of 32 participants averted their gaze while
recalling an answer, with a **median of 3.9 seconds**. A 3 s threshold would
have flagged the median honest candidate. It was raised to 6 s.

The general bias throughout: **favour missing a real incident over falsely
flagging an innocent one.** A missed flag costs a reviewer nothing. A false
flag can cost a candidate their application.

---

## Known limitations

Ordered by how much they matter.

**A candidate can read a sentence off a phone without being caught.** Silent
reading runs at ~238 WPM, so a fifteen-word sentence takes roughly 3.8 s — but
the gaze flag needs 6 s. Lowering the threshold to close this gap would flag
honest candidates instead. The signal catches sustained disengagement, not
brief glances. This is a limit of the approach rather than a bug in it.

**Two sub-threshold look-aways less than a second apart merge into one event,
and the reported duration includes the gap.** The recovery window correctly
prevents event splitting, but it also prevents the timer resetting. The merge
is arguably right — a 0.4 s glance mid-look-away is one disengagement — but the
duration overstates it. Found by writing probe tests.

**Back-navigation can re-log a paste.** Answers deduplicate on re-save
(delete-then-insert); events are append-only and do not. Navigating away and
back to a pasted answer can add a second paste event and inflate the risk score.

**No authentication.** `POST /events` accepts any `session_id`. Anyone who can
reach the API can fabricate or suppress flags.

**Head roll is not corrected.** Yaw compares x-coordinates only, so a tilted
head shifts the ratio without any real turn.

**Threshold precision is bounded by the 200 ms sample interval.** "6000 ms"
means "6000 ms as observed at 5 Hz."

**Optional signals were deliberately skipped** — phone detection and second-
screen detection would need a second model competing for the same frame budget.
Three signals done properly beat five done shallowly.

---

## Privacy

**What is processed:** video frames, in the browser, in memory, discarded
immediately after measurement.

**What is stored:** the applicant's name, email and role; timestamps; answer
text; typing statistics (keystroke count, duration, fastest burst, whether a
paste occurred); and flagged events (type, time, duration, question number).

**What is never stored or transmitted:** video, images, screenshots, facial
landmarks, or any biometric data. No frame ever reaches the server. The
backend runs no model.

**Retention:** everything lives in `backend/proctoring.db` until that file is
deleted. A production system would need a defined retention window and a
deletion path; this prototype has neither.

The candidate sees a plain-English notice before the camera starts, their own
video feed throughout, and a live status indicator showing what the system
currently thinks. Nothing is hidden from the person being monitored.

---

## Fairness

Proctoring systems carry unequal error burdens, and this one is no exception.

- **NIST IR 8280** found false-positive differentials in face recognition
  varying by up to a factor of **~7,203** across demographic groups — far
  exceeding false-negative differentials.
- A **peer-reviewed audit of a commercial proctoring product** found students
  with darker and medium skin tones were flagged for a significantly greater
  percentage of their assessment duration than White peers.
- **Gaze aversion is a documented cognitive-load management strategy**,
  including in autistic people. A gaze-based signal systematically
  disadvantages neurodivergent candidates.

The same threshold produces different flag rates for different people. This is
the direct reason for three design decisions:

1. Flags are advisory. Nothing auto-rejects.
2. The risk band is computed at display time and never stored, so evidence is
   never overwritten by a conclusion and weights can be revised later.
3. The advisory note ships **inside the API response**, not only in the UI, so
   it cannot be lost by whatever consumes the data next.

---

## With more time

**Correctness first.** Fix the paste double-logging; separate accumulated
condition-time from wall-clock span in the debouncer; correct yaw for head roll.

**Better signals.** Genuine human inter-keystroke intervals vary with bigram
frequency and hand alternation, while injected text shows unnaturally low
timing variance — a variance-based check would be far more principled than a
raw speed ceiling. Calibrate head pose per candidate during the camera check,
so thresholds adapt to seating position rather than assuming a centred webcam.

**Honesty about confidence.** Surface per-signal confidence in the summary, and
show reviewers what the system could *not* determine (poor lighting, partial
occlusion) rather than silently producing a clean report.

**Reviewer tooling.** At scale the bottleneck is not compute — the CV runs on
candidates' machines — but triage. A thousand sessions producing thousands of
flags needs sorting, filtering and case management far more than it needs a
faster model.

**Production hardening.** Session tokens, a retention policy with automatic
deletion, and validation of each threshold per demographic subgroup rather
than assuming uniform accuracy.

---

## Project structure

```
backend/
  main.py            7 endpoints; never receives a frame
  db.py              6 queries; the only file touching SQLite
  risk.py            the only file with an opinion
  schema.sql         4 tables
  requirements.txt

frontend/src/
  App.jsx            screen switcher; one state variable, no router
  api.js             one function per endpoint
  thresholds.js      every tunable number, with citations
  questions.js       fixed content
  screens/
    Intake.jsx       form -> session
    CameraGate.jsx   hard block; distinguishes denied from unavailable
    Questionnaire.jsx  stepper, telemetry, live indicator
    Summary.jsx      the reviewer's view
  lib/
    faceTracker.js     MediaPipe -> face count + head pose
    debounce.js        sustained-state detection
    typing.js          keystroke and paste telemetry
    useCameraMonitor.js  the 200ms loop tying it together

docs/
  RESEARCH.md        sources behind every threshold
```

---

## AI assistance

This was built with Claude Code, as the brief encourages. Every line was
reviewed and every design decision is defensible — including the three bugs
documented above, which were found by writing probe tests rather than by
reading the code.
