// src/pages/LoginPage.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../api";

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation() as any;

  const [email, setEmail] = useState("admin@local");
  const [password, setPassword] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      const to = loc?.state?.from || "/work-orders";
      nav(to, { replace: true });
    } catch (ex: any) {
      setErr(ex?.message || String(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 420, margin: "40px auto" }}>
      <h2 style={{ marginTop: 0 }}>CMMS Login</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ padding: 10 }}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          style={{ padding: 10 }}
        />
        <button type="submit" disabled={loading} style={{ padding: 10 }}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>

      {err && (
        <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Dacă nu ai user încă, creează-l din Swagger (register) sau ajustează credentialele.
      </div>
    </div>
  );
}
