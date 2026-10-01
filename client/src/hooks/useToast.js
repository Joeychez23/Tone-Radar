import { createContext, createElement, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);
  const dismiss = useCallback((tid) => setToasts((t) => t.filter((x) => x.id !== tid)), []);
  const show = useCallback(
    (message, { tone = "info", duration = 3200 } = {}) => {
      const tid = ++id.current;
      setToasts((t) => [...t.slice(-2), { id: tid, message, tone }]);
      setTimeout(() => dismiss(tid), duration);
    },
    [dismiss]
  );
  const value = useMemo(() => show, [show]);
  return createElement(
    ToastContext.Provider,
    { value },
    children,
    createElement(
      "div",
      { className: "toasts", role: "status", "aria-live": "polite" },
      toasts.map((t) =>
        createElement("div", { key: t.id, className: `toast toast-${t.tone}`, onClick: () => dismiss(t.id) }, t.message)
      )
    )
  );
}

export const useToast = () => useContext(ToastContext);
