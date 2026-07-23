// Every tunable number in the system lives here, with the reason it was chosen.
// Kept in one file so "why that number?" has a single place to look.
//
// The values are derived from published behavioural research, not guessed.
// Full sources and derivations: docs/RESEARCH.md
//
// General bias: all thresholds are set to favour MISSING a real incident over
// falsely flagging an innocent one. A missed flag costs a reviewer nothing --
// they see a clean session that was slightly dirty. A false flag can cost a
// candidate their application. So every number below errs on the generous side.

// --- Camera sampling -------------------------------------------------------

// How often we look at the video. The face model can run faster, but 5x/second
// is plenty to measure behaviour lasting seconds, and it keeps the CPU free so
// the typing stays responsive.
export const SAMPLE_INTERVAL_MS = 200;

// --- Gaze / attention ------------------------------------------------------

// Head yaw (left-right) beyond this counts as "turned away" for that sample.
// Set well outside normal micro-movement while reading a screen.
export const GAZE_YAW_DEGREES = 25;

// Head pitch (up-down) beyond this counts as looking away -- e.g. down at a
// phone in the lap. Larger than yaw because people naturally tilt down to
// read the lower half of a screen.
export const GAZE_PITCH_DEGREES = 20;

// How long the head must stay turned before we record anything.
//
// 6s, and this is the most carefully chosen number in the file.
// Eye-tracking research (Acta Psychologica 2023) found 30 of 32 participants
// averted their gaze while recalling an answer, with a MEDIAN aversion of
// ~3.9 seconds. A 3s threshold -- our first guess -- would have flagged the
// median honest candidate answering a question truthfully.
// 6s sits well clear of that. See docs/RESEARCH.md section 2.
export const GAZE_AWAY_SUSTAIN_MS = 6000;

// --- Presence --------------------------------------------------------------

// No face for this long = candidate left the frame.
// Mean blink duration while reading is ~129ms, with the longest observed
// around 347ms (Scientific Reports 2025). 3s is roughly 23x the mean blink
// and ~9x the longest, so blinking, a hand passing over the face, or a few
// dropped frames cannot trigger it.
export const NO_FACE_SUSTAIN_MS = 3000;

// Two or more faces for this long = someone else is present. Shorter than the
// others because a second face is a stronger signal, but not instant: the
// detector occasionally fires on a poster, reflection, or photo for one frame.
export const MULTI_FACE_SUSTAIN_MS = 2000;

// --- Recovery (hysteresis) -------------------------------------------------

// Once an event is open, conditions must return to normal for this long before
// we close it. Asymmetric on purpose: without it, one continuous look-away
// broken by a single good frame would shatter into several separate events.
// 1s is ~2x the 500ms window that the Acta Psychologica gaze study used to
// exclude blinks from counting as aversions.
export const RECOVERY_MS = 1000;

// --- Typing ----------------------------------------------------------------

// Sustained characters-per-second above this is not human typing.
//
// Grounded in the largest public typing dataset: 168,000 people, 136 million
// keystrokes (CHI 2018). Mean 51.6 WPM, fastest 5% above 80 WPM, and a
// MAXIMUM OBSERVED of ~120 WPM. At ~5 characters per word that ceiling is
// ~10 cps, so 12 sits above the fastest typist in a 168k-person sample.
// Honest caveat: that study also found typing speed is unimodally
// distributed -- there is no natural "fast typist" cluster to cut at, so any
// single threshold is somewhat arbitrary. See docs/RESEARCH.md section 3.
export const MAX_PLAUSIBLE_CPS = 12;

// A single jump larger than this, with no matching keystrokes, is treated as
// inserted rather than typed. Catches autofill and drag-drop, which do not
// always fire a paste event. 30 chars is ~2.5s of typing at the mean speed
// appearing in one 200ms sample -- not physically possible by hand.
export const BULK_INSERT_CHARS = 30;
