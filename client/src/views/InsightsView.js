import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { AUDIENCES, DIMENSIONS, DIM_BY_ID } from "../lib/dimensions";
import { compact, shortDate } from "../lib/format";
import { LineChart, BarList } from "../components/charts";
import Icon from "../components/Icon";
import { Gate } from "./DraftsView";

const RANGES = [
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last year" },
];

const SERIES = [
  { key: "readiness", label: "When sent", className: "s-now" },
  { key: "baselineReadiness", label: "First check", className: "s-baseline" },
];

export default function InsightsView({ active, onRequireAccount }) {
  const { status, accountsAvailable } = useAuth();
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api(`/insights?days=${days}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (status === "signedIn" && active) load();
  }, [status, active, load]);

  if (status !== "signedIn") {
    return (
      <Gate
        icon="chart"
        title="See how your tone changes over time"
        body={
          accountsAvailable
            ? "Sign in and every message you copy to send is logged as scores only (never the text), so you can see your habits and how much you improve before sending."
            : "Insights need the database, which isn't connected right now."
        }
        action={accountsAvailable ? () => onRequireAccount("Sign in to track your tone over time.") : null}
      />
    );
  }

  const t = data?.totals;
  const empty = data && t.messages === 0;

  return (
    <div className="page insights">
      <div className="page-head">
        <h1>Insights</h1>
      </div>
      <div className="filter-row" role="radiogroup" aria-label="Date range">
        {RANGES.map((r) => (
          <button key={r.days} role="radio" aria-checked={days === r.days} className={`pill ${days === r.days ? "on" : ""}`} onClick={() => setDays(r.days)}>
            {days === r.days && <Icon name="check" size={14} strokeWidth={3} />} {r.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-box">
          {error}{" "}
          <button className="link" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {!data && !error && <div className="muted">Loading insights…</div>}

      {empty && (
        <div className="card empty">
          <Icon name="chart" size={28} />
          <p>Nothing here yet. When you press <strong>Copy &amp; send</strong> on a message, its scores show up here.</p>
          <a className="btn" href="#/compose">
            <Icon name="pen" size={15} /> Check a message
          </a>
        </div>
      )}

      {data && !empty && (
        <div className={`insights-body ${loading ? "is-refreshing" : ""}`}>
          <div className="tiles">
            <div className="tile tile-hero">
              <span className="tile-label">Average readiness when sent</span>
              <span className="tile-value">{t.avgReadiness ?? "–"}</span>
              {t.avgImprovement !== null && (
                <span className={`tile-delta ${t.avgImprovement >= 0 ? "up" : "down"}`}>
                  {t.avgImprovement >= 0 ? "+" : "−"}
                  {Math.abs(t.avgImprovement)} pts vs. first check
                </span>
              )}
            </div>
            <Tile label="Messages checked" value={compact(t.messages)} />
            <Tile label="Sent with no hot sentences" value={`${Math.round((t.sentClean / t.messages) * 100)}%`} />
            <Tile label="Fixes applied" value={compact(t.fixesApplied)} />
            <Tile label="Day streak" value={t.streak} />
          </div>

          <section className="card chart-card">
            <div className="chart-head">
              <div>
                <h2>Readiness over time</h2>
                <p className="muted small">Daily average score (0–100) of messages when you first checked them and when you sent them.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
                <Icon name="table" size={14} /> {showTable ? "Chart" : "Table"}
              </button>
            </div>
            <Legend series={SERIES} />
            {showTable ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="num">Messages</th>
                      <th className="num">First check</th>
                      <th className="num">When sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((d) => (
                      <tr key={d.date}>
                        <td>{shortDate(d.date)}</td>
                        <td className="num">{d.count}</td>
                        <td className="num">{d.baselineReadiness ?? "–"}</td>
                        <td className="num">{d.readiness ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <LineChart
                ariaLabel="Readiness over time"
                data={data.daily.map((d) => ({ label: shortDate(d.date), readiness: d.readiness, baselineReadiness: d.baselineReadiness, note: `${d.count} message${d.count === 1 ? "" : "s"}` }))}
                series={SERIES}
              />
            )}
          </section>

          <section className="card chart-card">
            <div className="chart-head">
              <div>
                <h2>Each dimension, week by week</h2>
                <p className="muted small">Average peak heat (%) per message. Lower is cooler.</p>
              </div>
            </div>
            <Legend series={[{ label: "When sent", className: "s-now" }, { label: "First check", className: "s-baseline" }]} />
            <div className="multiples">
              {DIMENSIONS.map((d) => (
                <div key={d.id} className="multiple">
                  <h3>{d.label}</h3>
                  <LineChart
                    height={150}
                    ariaLabel={`${d.label} by week`}
                    yTicks={[0, 50, 100]}
                    formatY={(v) => `${Math.round(v)}%`}
                    data={data.weekly.map((w) => ({ label: shortDate(w.week), now: w[d.id], base: w[`${d.id}Baseline`], note: `Week of ${shortDate(w.week)}` }))}
                    series={[
                      { key: "now", label: "When sent", className: "s-now" },
                      { key: "base", label: "First check", className: "s-baseline" },
                    ]}
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="two-col">
            <section className="card chart-card">
              <h2>Your tone habits</h2>
              <p className="muted small">The patterns Tone Radar found most often, and how often you fixed them.</p>
              {data.patterns.length ? (
                <BarList
                  rows={data.patterns.map((p) => ({
                    key: p.id,
                    label: p.label,
                    value: p.count,
                    sub: `${DIM_BY_ID[p.dim]?.label ?? p.dim} · fixed ${p.fixed} of ${p.count}`,
                  }))}
                />
              ) : (
                <p className="muted">No patterns recorded yet. Inspect a flagged sentence to find them.</p>
              )}
            </section>
            <section className="card chart-card">
              <h2>By audience</h2>
              <p className="muted small">Average readiness when sent, by who the message was for.</p>
              <BarList
                max={100}
                rows={data.audiences.map((a) => ({
                  key: a.audience,
                  label: AUDIENCES.find((x) => x.id === a.audience)?.label ?? a.audience,
                  value: a.readiness ?? 0,
                  sub: `${a.count} message${a.count === 1 ? "" : "s"}`,
                }))}
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
    </div>
  );
}

function Legend({ series }) {
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.label} className="legend-item">
          <span className={`key key-line ${s.className}`} /> {s.label}
        </span>
      ))}
    </div>
  );
}
