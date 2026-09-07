import { useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import "./OperationsPage.css";

/** Login page: authenticates against /api/auth/login via useAuth() and stores the JWT session. */
function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      await login({ email, password });
    } catch (loginError) {
      setError(loginError instanceof TypeError ? "Unable to reach the backend." : loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark login-mark">GS</div>
        <p className="eyebrow">Global Shop / Secure access</p>
        <h1>Welcome back.</h1>
        <p className="login-copy">Sign in to manage production, materials, quality, and finance.</p>

        {error && <p className="operation-alert" role="alert">{error}</p>}

        <form className="operation-form" onSubmit={submit}>
          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="form-submit" disabled={loading} type="submit">
            <LogIn size={16} /> {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="login-note">
          <LockKeyhole size={14} /> Access is protected by role-based permissions.
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
