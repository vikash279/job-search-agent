import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { client, setToken } from "../api";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const payload = {
        email: String(form.get("email")),
        password: String(form.get("password")),
        name: String(form.get("name") || "Candidate"),
      };
      const result = mode === "login" ? await client.login(payload) : await client.register(payload);
      setToken(result.token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1 className="serif">Harbor</h1>
        <p className="muted">Find roles from your CV, prepare applications, and apply only after you approve.</p>
        {mode === "register" && (
          <label>
            Name
            <input name="name" required defaultValue="Demo Candidate" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required defaultValue="demo@example.com" />
        </label>
        <label>
          Password
          <input name="password" type="password" required defaultValue="demo12345" minLength={8} />
        </label>
        {error && <p className="notice">{error}</p>}
        <button className="btn" disabled={pending}>{mode === "login" ? "Sign in" : "Create account"}</button>
        <p className="muted">
          {mode === "login" ? <Link to="/register">Need an account?</Link> : <Link to="/login">Already registered?</Link>}
        </p>
      </form>
    </div>
  );
}
