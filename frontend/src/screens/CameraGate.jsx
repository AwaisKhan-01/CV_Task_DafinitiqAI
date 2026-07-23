import { useEffect, useRef, useState } from "react";
import { endSession } from "../api";

// The camera is a hard gate: without a working camera the questionnaire does
// not start. This is also where the candidate is told what is being recorded,
// before anything is recorded.
export default function CameraGate({ sessionId, onReady }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [state, setState] = useState("asking"); // asking | ready | denied
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function ask() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setState("ready");
      } catch (err) {
        // Distinguish "said no" from "no camera present" -- the candidate can
        // fix one of these and not the other.
        const denied = err.name === "NotAllowedError";
        setMessage(
          denied
            ? "Camera access was blocked. This screening cannot continue without it. Allow camera access in your browser's address bar, then retry."
            : "No working camera was found. Connect a camera, close any other app using it, then retry."
        );
        setState("denied");
        // Record the attempt so a reviewer sees why the session stopped here.
        endSession(sessionId, "abandoned").catch(() => {});
      }
    }

    ask();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state === "denied") {
    return (
      <div className="card">
        <h2>Camera required</h2>
        <p className="error">{message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Camera check</h2>

      <video ref={videoRef} autoPlay playsInline muted className="preview" />

      <div className="notice">
        <strong>What happens during this screening</strong>
        <ul>
          <li>Your camera stays on for the whole questionnaire.</li>
          <li>
            Video is analysed <strong>on this computer only</strong>. It is
            never uploaded or sent anywhere.
          </li>
          <li>
            No video, images or photos are stored. Only short notes such as
            "looked away for 4 seconds during question 2".
          </li>
          <li>
            These notes are reviewed by a person. They are not a decision and
            nobody is rejected automatically.
          </li>
        </ul>
      </div>

      <button
        disabled={state !== "ready"}
        onClick={() => onReady(streamRef.current)}
      >
        {state === "ready" ? "Begin questionnaire" : "Waiting for camera..."}
      </button>
    </div>
  );
}
