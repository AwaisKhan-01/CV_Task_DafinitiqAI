import { useState } from "react";
import Intake from "./screens/Intake";
import CameraGate from "./screens/CameraGate";
import Questionnaire from "./screens/Questionnaire";
import Summary from "./screens/Summary";
import "./App.css";

// No router. One variable says which screen is showing, and each screen calls
// back to move to the next. Four screens in a straight line does not need
// routing, and this is easier to explain and debug.
export default function App() {
  const [screen, setScreen] = useState("intake");
  const [sessionId, setSessionId] = useState(null);

  // The camera is opened once at the gate and the stream handed onward, so the
  // candidate is not asked for permission twice.
  const [stream, setStream] = useState(null);

  return (
    <div className="app">
      <header className="topbar">
        <strong>Applicant Screening</strong>
        <span className="muted">Proctored session</span>
      </header>

      {screen === "intake" && (
        <Intake
          onDone={(id) => {
            setSessionId(id);
            setScreen("camera");
          }}
        />
      )}

      {screen === "camera" && (
        <CameraGate
          sessionId={sessionId}
          onReady={(s) => {
            setStream(s);
            setScreen("questionnaire");
          }}
        />
      )}

      {screen === "questionnaire" && (
        <Questionnaire
          sessionId={sessionId}
          stream={stream}
          onDone={() => setScreen("summary")}
        />
      )}

      {screen === "summary" && <Summary sessionId={sessionId} />}
    </div>
  );
}
