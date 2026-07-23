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

import { BULK_INSERT_CHARS, MAX_PLAUSIBLE_CPS } from "../thresholds";

export function createTypingTracker() {
  let keystrokes = 0;
  let startedAt = null;
  let lastLength = 0;
  let lastTickAt = null;
  let maxCps = 0;
  let pasted = false;
  const flags = []; // { kind, chars } for each suspicious insertion

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

        // Sustained rate between edits. Guarded against the first tick and
        // against division by a tiny interval producing nonsense.
        if (lastTickAt !== null) {
          const seconds = (now - lastTickAt) / 1000;
          if (seconds > 0.05) {
            const cps = grew / seconds;
            if (cps > maxCps) maxCps = cps;
            if (cps > MAX_PLAUSIBLE_CPS && grew > 5) {
              pasted = true;
              flags.push({ kind: "fast_burst", chars: grew });
            }
          }
        }
      }

      lastLength = value.length;
      lastTickAt = now;
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
      lastTickAt = null;
      maxCps = 0;
      pasted = false;
      flags.length = 0;
    },

    /** Back-navigation returns to existing text; do not count it as typed. */
    seed(text) {
      lastLength = text.length;
    },
  };
}
