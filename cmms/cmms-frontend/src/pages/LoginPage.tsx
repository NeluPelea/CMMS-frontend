import { useState } from "react";
import { login, isAuthed } from "../api";
import { Navigate, useNavigate } from "react-router-dom";

export default function LoginPage() {
  const nav = useNavigate();

  const [email, setEmail] = useState("admin@cmms.local");
  const [password, setPassword] = useState("Parola123");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthed()) return <Navigate to="/work-orders" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      nav("/work-orders", { replace: true });
    } catch (ex: any) {
      setErr(String(ex?.message ?? ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 20, border: "1px solid #ddd", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Login</h2>

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 10 }}>
          <label>Email</label>
          <input
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Password</label>
          <input
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {err && <div style={{ color: "crimson", marginBottom: 10, whiteSpace: "pre-wrap" }}>{err}</div>}

        <button type="submit" disabled={busy} style={{ padding: "8px 12px" }}>
          {busy ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
