// Turns a noisy per-sample true/false into a small number of real events.
//
// This is the single most important piece of the CV pipeline. Without it,
// someone blinking or glancing at their coffee produces dozens of flags a
// second and the reviewer's summary becomes unreadable.
//
// The rule is a stopwatch, not a tripwire: we do not ask "is it true right
// now", we ask "how long has it been true".
//
// Deliberately asymmetric. Starting an event needs a long sustained period;
// ending it needs a shorter quiet period (RECOVERY_MS). Without that recovery
// window, one continuous look-away interrupted by a single good frame would
// be recorded as two separate events.

export function createSustainedDetector({ sustainMs, recoveryMs, onEvent }) {
  let conditionSince = null; // when the condition first became true
  let firing = false; // is an event currently open
  let firedAt = null; // when the open event started
  let normalSince = null; // when things last returned to normal

  return {
    /**
     * Call once per sample.
     * @param condition  true if the abnormal state is present this sample
     * @param now        timestamp in ms
     * @returns true while an event is open (for the live indicator)
     */
    update(condition, now) {
      if (condition) {
        normalSince = null;
        if (conditionSince === null) conditionSince = now;

        // Held long enough, and not already reported -> open an event.
        if (!firing && now - conditionSince >= sustainMs) {
          firing = true;
          firedAt = conditionSince;
        }
      } else {
        // Condition dropped. Do not close immediately -- it may be a blink or
        // a single bad frame. Require a quiet period first.
        if (normalSince === null) normalSince = now;

        if (now - normalSince >= recoveryMs) {
          if (firing) {
            // Duration measures from when the condition began, not from when
            // we decided to report it.
            onEvent(now - recoveryMs - firedAt);
            firing = false;
            firedAt = null;
          }
          conditionSince = null;
        }
      }
      return firing;
    },

    /** Session ended while an event was still open -- record it anyway. */
    flush(now) {
      if (firing) {
        onEvent(now - firedAt);
        firing = false;
        firedAt = null;
        conditionSince = null;
      }
    },
  };
}
