// Runs the camera loop and turns measurements into logged events.
//
// The flow is the same for all three camera signals:
//   sample the frame -> measure -> compare to a threshold -> sustain -> log
//
// Only the last two steps decide anything. faceTracker reports facts;
// thresholds.js holds the numbers; debounce.js holds the timing rule.

import { useEffect, useRef, useState } from "react";
import { createFaceLandmarker, measureFrame } from "./faceTracker";
import { createSustainedDetector } from "./debounce";
import { logEvent } from "../api";
import {
  GAZE_AWAY_SUSTAIN_MS,
  GAZE_PITCH_DEGREES,
  GAZE_YAW_DEGREES,
  MULTI_FACE_SUSTAIN_MS,
  NO_FACE_SUSTAIN_MS,
  RECOVERY_MS,
  SAMPLE_INTERVAL_MS,
} from "../thresholds";

export function useCameraMonitor({ sessionId, videoRef, questionRef }) {
  // What the reviewer sees live: "ok" | "away" | "no_face" | "multi_face"
  const [status, setStatus] = useState("starting");
  const [ready, setReady] = useState(false);

  // Kept in a ref so the loop always sees the current value without
  // re-creating itself on every render.
  const flushRef = useRef(null);

  useEffect(() => {
    let landmarker = null;
    let timer = null;
    let stopped = false;

    // A detector per signal. Each one logs its own event type.
    const gaze = createSustainedDetector({
      sustainMs: GAZE_AWAY_SUSTAIN_MS,
      recoveryMs: RECOVERY_MS,
      onEvent: (ms) =>
        logEvent(sessionId, "gaze_away", ms, questionRef.current, "head turned from screen"),
    });

    const noFace = createSustainedDetector({
      sustainMs: NO_FACE_SUSTAIN_MS,
      recoveryMs: RECOVERY_MS,
      onEvent: (ms) =>
        logEvent(sessionId, "no_face", ms, questionRef.current, "no face detected"),
    });

    const multiFace = createSustainedDetector({
      sustainMs: MULTI_FACE_SUSTAIN_MS,
      recoveryMs: RECOVERY_MS,
      onEvent: (ms) =>
        logEvent(sessionId, "multi_face", ms, questionRef.current, "more than one face"),
    });

    flushRef.current = () => {
      const now = Date.now();
      gaze.flush(now);
      noFace.flush(now);
      multiFace.flush(now);
    };

    function tick() {
      if (stopped || !landmarker) return;
      const video = videoRef.current;

      // Wait until the video actually has pixels to read.
      if (!video || video.readyState < 2) return;

      const now = Date.now();
      let measurement;
      try {
        measurement = measureFrame(landmarker, video, performance.now());
      } catch {
        return; // a dropped frame is not an event
      }

      const { faceCount, pose } = measurement;

      const away =
        pose !== null &&
        (Math.abs(pose.yaw) > GAZE_YAW_DEGREES ||
          Math.abs(pose.pitch) > GAZE_PITCH_DEGREES);

      // Gaze is only meaningful when exactly one face is visible: with nobody
      // there, there is no head to measure, and "left the frame" already
      // covers it.
      const gazeFiring = gaze.update(faceCount === 1 && away, now);
      const noFaceFiring = noFace.update(faceCount === 0, now);
      const multiFiring = multiFace.update(faceCount >= 2, now);

      // Most serious state wins the live indicator.
      if (multiFiring) setStatus("multi_face");
      else if (noFaceFiring) setStatus("no_face");
      else if (gazeFiring) setStatus("away");
      else setStatus("ok");
    }

    createFaceLandmarker()
      .then((lm) => {
        if (stopped) {
          lm.close();
          return;
        }
        landmarker = lm;
        setReady(true);
        setStatus("ok");
        timer = setInterval(tick, SAMPLE_INTERVAL_MS);
      })
      .catch(() => setStatus("model_failed"));

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      // Record anything still open when the questionnaire ends.
      flushRef.current?.();
      landmarker?.close();
    };
  }, [sessionId, videoRef, questionRef]);

  return { status, ready };
}
