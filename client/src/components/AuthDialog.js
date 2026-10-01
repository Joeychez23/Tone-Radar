import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import Icon from "./Icon";

// Sign in / create account dialog using the native <dialog> element.
export default function AuthDialog({ open, onClose, reason }) {
  const { signIn, register } = useAuth();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setError("");
      el.showModal?.();
    } else if (!open && el.open) {
      el.close?.();
    }
  }, [open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") await signIn(form.email, form.password);
      else await register(form.email, form.password, form.name);
      setForm({ name: "", email: "", password: "" });
      onClose(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="dialog" onClose={() => onClose(false)} onCancel={() => onClose(false)} aria-labelledby="auth-title">
      <form onSubmit={submit} className="dialog-body">
        <button type="button" className="icon-btn dialog-close" onClick={() => onClose(false)} aria-label="Close">
          <Icon name="x" />
        </button>
        <h2 id="auth-title">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
        <p className="muted small">
          {reason || "Save drafts, keep your sensitivity settings, and see how your tone changes over time."} Message text is only stored when you save a
          draft.
        </p>
        {mode === "register" && (
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={set("name")} autoComplete="name" maxLength={80} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            value={form.password}
            onChange={set("password")}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          {mode === "register" && <small className="muted">At least 8 characters.</small>}
        </label>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <p className="small center">
          {mode === "signin" ? "New to Tone Radar?" : "Already have an account?"}{" "}
          <button type="button" className="link" onClick={() => { setMode(mode === "signin" ? "register" : "signin"); setError(""); }}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </dialog>
  );
}
