// Camera analysis. Runs entirely in the browser: frames are read from the
// video element, measured, and discarded. No image ever leaves this machine
// and none is stored -- only short conclusions like "looked away for 6s".
//
// Uses MediaPipe Face Landmarker, which gives us all three camera signals
// from one model: how many faces are present, and where each head is pointed.

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Landmark indices in MediaPipe's 468-point face mesh.
const NOSE_TIP = 1;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;
const CHIN = 152;
const FOREHEAD = 10;

/**
 * Head pose from face landmarks, without a full 3D solve.
 *
 * Yaw (looking left/right): compare how far the nose sits from each eye
 * horizontally. Facing forward the distances are equal; turning the head
 * pushes the nose toward one eye in the 2D projection.
 *
 * Pitch (looking up/down): where the nose sits vertically between forehead
 * and chin. Facing forward it sits near the middle of that span.
 *
 * This is an approximation, chosen over solvePnP because it needs no camera
 * calibration and no 3D reference model, and is easy to explain and debug.
 * It measures HEAD ORIENTATION, not eye gaze -- someone can face the camera
 * and still read a second monitor with their eyes. Stated in the README.
 */
export function estimateHeadPose(landmarks) {
  const nose = landmarks[NOSE_TIP];
  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];
  const chin = landmarks[CHIN];
  const forehead = landmarks[FOREHEAD];

  // --- yaw ---
  const toLeft = Math.abs(nose.x - leftEye.x);
  const toRight = Math.abs(rightEye.x - nose.x);
  const eyeSpan = toLeft + toRight;
  // -1 (fully turned one way) .. 0 (centred) .. +1
  const yawRatio = eyeSpan > 0 ? (toRight - toLeft) / eyeSpan : 0;
  // Scale to degrees. 60 is empirical: a ratio of ~0.4 corresponds to roughly
  // a 25 degree turn, which is where we set the threshold.
  const yaw = yawRatio * 60;

  // --- pitch ---
  const faceHeight = Math.abs(chin.y - forehead.y);
  // 0 = forehead, 1 = chin. A forward-facing head sits near 0.5.
  const nosePos = faceHeight > 0 ? (nose.y - forehead.y) / faceHeight : 0.5;
  const pitch = (nosePos - 0.5) * 100;

  return { yaw, pitch };
}

/**
 * Load the model. Called once, at the camera gate, so it is warm later.
 *
 * The wasm runtime and the 3.6MB model file are vendored into public/ rather
 * than pulled from a CDN: the brief requires the system to run locally, and a
 * demo that needs internet access is a demo that can fail in the room.
 */
export async function createFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks("/mediapipe/wasm");

  return FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: "/mediapipe/model/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    // We only need to know if a second person is present, not track a crowd.
    numFaces: 2,
  });
}

/**
 * Measure one video frame.
 * Returns face count and head pose -- raw facts, no judgement. Deciding what
 * counts as "away" happens in the questionnaire, against named thresholds.
 */
export function measureFrame(landmarker, video, timestampMs) {
  const result = landmarker.detectForVideo(video, timestampMs);
  const faces = result.faceLandmarks || [];

  if (faces.length === 0) return { faceCount: 0, pose: null };

  return {
    faceCount: faces.length,
    pose: estimateHeadPose(faces[0]),
  };
}
