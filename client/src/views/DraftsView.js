import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { AUDIENCES, CHANNELS } from "../lib/dimensions";
import { readinessLabel } from "../lib/heat";
import { timeAgo } from "../lib/format";
import { MiniRadar } from "../components/charts";
import Icon, { TierIcon } from "../components/Icon";

export default function DraftsView({ onOpen, onRequireAccount }) {
  const { status, accountsAvailable } = useAuth();
  const toast = useToast();
  const [drafts, setDrafts] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const { drafts } = await api("/drafts");
      setDrafts(drafts);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (status === "signedIn") load();
  }, [status, load]);

  const filtered = useMemo(() => {
    if (!drafts) return [];
    const q = query.trim().toLowerCase();
    return q ? drafts.filter((d) => `${d.title}\n${d.text}`.toLowerCase().includes(q)) : drafts;
  }, [drafts, query]);

  const remove = async (d) => {
    if (!window.confirm(`Delete “${d.title}”?`)) return;
    const prev = drafts;
    setDrafts((ds) => ds.filter((x) => x.id !== d.id));
    try {
      await api(`/drafts/${d.id}`, { method: "DELETE" });
      toast("Draft deleted.");
    } catch (err) {
      setDrafts(prev);
      toast(err.message, { tone: "warn" });
    }
  };

  if (status !== "signedIn") {
    return (
      <Gate
        title="Your drafts live here"
        body={accountsAvailable ? "Sign in to save messages you're still working on and come back to them later." : "Drafts need the database, which isn't connected right now."}
        action={accountsAvailable ? () => onRequireAccount("Sign in to save and reopen drafts.") : null}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Drafts</h1>
        <label className="search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search drafts" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search drafts" />
        </label>
      </div>
      {error && (
        <div className="error-box">
          {error}{" "}
          <button className="link" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {drafts === null && !error && <div className="muted">Loading drafts…</div>}
      {drafts && drafts.length === 0 && (
        <div className="card empty">
          <p>No drafts yet. Press <kbd>⌘S</kbd> while writing to save one.</p>
          <a className="btn" href="#/compose">
            Start writing
          </a>
        </div>
      )}
      <div className="draft-grid">
        {filtered.map((d) => {
          const r = readinessLabel(d.readiness);
          return (
            <article key={d.id} className="card draft-card">
              <button className="draft-open" onClick={() => onOpen(d)} aria-label={`Open draft ${d.title}`}>
                <div className="draft-top">
                  <MiniRadar values={d.radar} />
                  <div className="draft-meta">
                    <h3>{d.title}</h3>
                    <span className="muted small">
                      {CHANNELS.find((c) => c.id === d.channel)?.label} to {AUDIENCES.find((a) => a.id === d.audience)?.label.toLowerCase()}, {timeAgo(d.updatedAt)}
                    </span>
                  </div>
                </div>
                <p className="draft-snippet">{d.text}</p>
              </button>
              <div className="draft-foot">
                {d.readiness !== null && d.readiness !== undefined ? (
                  <span className={`chip chip-${r.tier}`}>
                    <TierIcon tier={r.tier} size={12} /> {r.label} ({d.readiness})
                  </span>
                ) : (
                  <span className="muted small">Not checked</span>
                )}
                <span className="spacer" />
                <button className="icon-btn" onClick={() => remove(d)} aria-label={`Delete draft ${d.title}`} title="Delete">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function Gate({ title, body, action }) {
  return (
    <div className="page">
      <div className="card gate">
        <h2>{title}</h2>
        <p className="muted">{body}</p>
        {action && (
          <button className="btn btn-primary" onClick={action}>
            Sign in or create an account
          </button>
        )}
      </div>
    </div>
  );
}
