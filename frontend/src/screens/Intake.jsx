import { useEffect, useState } from "react";
import { createApplicant, getRoles } from "../api";

// Applicant details. On submit the backend creates the applicant and a
// session, and returns the session id that every later call carries.
export default function Intake({ onDone }) {
  const [roles, setRoles] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Roles come from the backend so the list has one source of truth.
  useEffect(() => {
    getRoles()
      .then(setRoles)
      .catch(() => setError("Cannot reach the server. Is the backend running?"));
  }, []);

  function validate() {
    if (!name.trim()) return "Please enter your name.";
    // Deliberately loose: something@something.something. The backend checks
    // the same thing again -- we do not trust the client.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return "Please enter a valid email address.";
    if (!role) return "Please select a role.";
    return "";
  }

  async function submit(e) {
    e.preventDefault();
    const problem = validate();
    if (problem) return setError(problem);

    setBusy(true);
    setError("");
    try {
      const { session_id } = await createApplicant(name.trim(), email.trim(), role);
      onDone(session_id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Your details</h2>
      <p className="muted">
        This screening is proctored. The next step will ask for camera access.
      </p>

      <form onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Select a role...</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={busy}>
          {busy ? "Starting..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
