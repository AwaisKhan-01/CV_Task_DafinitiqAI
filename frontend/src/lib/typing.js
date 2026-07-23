// Typing telemetry. Not computer vision -- this reads the keyboard and the
// text box directly, which makes it the most reliable signal in the system.
//
// Two independent detectors, because each catches what the other misses:
//
//   1. The browser's paste event. Unambiguous, essentially no false
//      positives, but only fires for an actual paste.
//   2. A bulk-insert check: the text grew far more than the keystrokes
//      account for. Catches autofill, drag-and-drop, and programmatic input,
//      none of which fire a paste event.
//
// Known false positives, stated honestly in the README: someone composing an
// answer in another editor and pasting it in is not cheating, and neither is
// a very fast typist. That is why a paste is a flag for a human to look at,
// not a verdict.

import { BULK_INSERT_CHARS, MAX_PLAUSIBLE_CPS } from "../thresholds.js";

// Speed is measured over a rolling window rather than between consecutive
// keystrokes. Measuring a single gap does not work: real typing grows the text
// by exactly one character at a time, so per-keystroke deltas carry no
// information about sustained rate, and a very fast typist produces intervals
// so short that rounding dominates. A window of ~1s smooths that out and is
// also the timescale the research figures are quoted at (WPM).
const SPEED_WINDOW_MS = 1000;

export function createTypingTracker() {
  let keystrokes = 0;
  let startedAt = null;
  let lastLength = 0;
  let maxCps = 0;
  let pasted = false;
  let inBurst = false; // currently inside a too-fast burst
  const flags = []; // { kind, chars } for each suspicious insertion

  // Rolling record of {at, added} for the last SPEED_WINDOW_MS.
  let recent = [];

  return {
    /** Every key press in the answer box. */
    onKeyDown() {
      if (startedAt === null) startedAt = Date.now();
      keystrokes += 1;
    },

    /** The browser told us directly that a paste happened. */
    onPaste(text) {
      pasted = true;
      flags.push({ kind: "paste", chars: text.length });
    },

    /**
     * Every change to the text box. Compares how much the text grew against
     * how much typing could plausibly explain it.
     */
    onChange(value) {
      const now = Date.now();
      if (startedAt === null) startedAt = now;

      const grew = value.length - lastLength;

      if (grew > 0) {
        // A jump this large in one edit cannot come from a single keystroke.
        if (grew >= BULK_INSERT_CHARS) {
          pasted = true;
          flags.push({ kind: "bulk_insert", chars: grew });
        }

        // Sustained rate across a rolling window. Keep the previous boundary
        // sample so the window has a start time to measure from -- without it
        // the span always omits one interval and under-reports the rate.
        recent.push({ at: now, added: grew });
        const cutoff = now - SPEED_WINDOW_MS;
        while (recent.length > 2 && recent[1].at < cutoff) recent.shift();

        const windowStart = recent[0].at;
        const span = now - windowStart;
        // Characters typed *after* the window start, i.e. within the span.
        const charsInWindow = recent
          .slice(1)
          .reduce((n, r) => n + r.added, 0);

        // Judge once enough characters have accumulated to be meaningful.
        // Requiring a minimum span instead would never trigger on genuinely
        // machine-speed input, which delivers everything before the span is
        // reached.
        if (span > 0 && charsInWindow >= 5) {
          const cps = (charsInWindow / span) * 1000;
          if (cps > maxCps) maxCps = cps;

          // One sustained burst should produce one flag, not one per
          // keystroke, so only record a new burst after typing has dropped
          // back to a plausible rate in between.
          if (cps > MAX_PLAUSIBLE_CPS) {
            if (!inBurst) {
              inBurst = true;
              pasted = true;
              flags.push({ kind: "fast_burst", chars: charsInWindow });
            }
          } else {
            inBurst = false;
          }
        }
      }

      lastLength = value.length;
    },

    /** Snapshot for saving alongside the answer. */
    summary() {
      return {
        keystrokes,
        durationMs: startedAt ? Date.now() - startedAt : 0,
        maxCps: Math.round(maxCps * 10) / 10,
        pasted,
        flags,
      };
    },

    /** Moving to another question -- start counting again. */
    reset() {
      keystrokes = 0;
      startedAt = null;
      lastLength = 0;
      maxCps = 0;
      pasted = false;
      inBurst = false;
      flags.length = 0;
      recent = [];
    },

    /** Back-navigation returns to existing text; do not count it as typed. */
    seed(text) {
      lastLength = text.length;
    },
  };
}
