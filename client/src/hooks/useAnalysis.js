import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

const DEBOUNCE_MS = 650;

// Re-analyzes the message shortly after the user stops typing. In-flight
// requests are cancelled when the text changes again; the server only sends
// changed sentences to Jev, so edits come back fast.
export function useAnalysis(text, { audience, channel, context }) {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | scanning | ready | error
  const [error, setError] = useState(null);
  const controller = useRef(null);
  const timer = useRef(null);

  const run = useCallback(
    async (body) => {
      controller.current?.abort();
      const ctrl = new AbortController();
      controller.current = ctrl;
      setStatus("scanning");
      setError(null);
      const started = performance.now();
      try {
        const data = await api("/analyze", { method: "POST", body, signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setResult({ ...data, text: body.text, options: { audience: body.audience, channel: body.channel, context: body.context }, roundTripMs: Math.round(performance.now() - started) });
        setStatus("ready");
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message);
        setStatus("error");
      }
    },
    []
  );

  useEffect(() => {
    const body = { text, audience, channel, context };
    clearTimeout(timer.current);
    if (!text.trim()) {
      controller.current?.abort();
      setResult(null);
      setStatus("idle");
      setError(null);
      return;
    }
    timer.current = setTimeout(() => run(body), DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [text, audience, channel, context, run]);

  useEffect(() => () => controller.current?.abort(), []);

  const refresh = useCallback(() => {
    clearTimeout(timer.current);
    if (text.trim()) run({ text, audience, channel, context });
  }, [text, audience, channel, context, run]);

  const stale = Boolean(result && result.text !== text);
  return { result, status, error, stale, refresh };
}
