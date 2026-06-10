import { useState } from "react";
import { Navigate } from "react-router-dom";
import { api, loadUser, loggedIn, saveSession } from "../api.js";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (loggedIn() && loadUser()) {
    return <Navigate replace to="/" />;
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        const payload = await api("/api/auth/register", {
          method: "POST",
          body: { email, password, full_name: fullName },
        });
        saveSession(payload.token, payload.user);
      } else {
        const payload = await api("/api/auth/login", {
          method: "POST",
          body: { email, password },
        });
        saveSession(payload.token, payload.user);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <header className="space-y-1 text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-sky-300">Enterprise</div>
          <h1 className="text-2xl font-semibold text-white">Asset Management</h1>
          <p className="text-sm text-slate-400">Sign in to manage hardware &amp; software.</p>
        </header>

        <div className="flex rounded-lg bg-slate-800 p-1 text-xs font-semibold">
          <button
            type="button"
            className={`flex-1 rounded-md py-2 ${mode === "login" ? "bg-sky-600 text-white" : "text-slate-400"}`}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2 ${mode === "register" ? "bg-sky-600 text-white" : "text-slate-400"}`}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          {mode === "register" ? (
            <label className="block text-sm font-medium">
              Full name
              <input
                required
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-sky-500 focus:ring"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
          ) : null}
          <label className="block text-sm font-medium">
            Email
            <input
              required
              type="email"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-sky-500 focus:ring"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              required
              type="password"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-sky-500 focus:ring"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-sky-600 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "register" ? "Register" : "Sign in"}
          </button>
        </form>

        
      </div>
    </div>
  );
}
