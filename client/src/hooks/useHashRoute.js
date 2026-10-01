import { useCallback, useEffect, useState } from "react";

const ROUTES = ["compose", "drafts", "insights"];

function current() {
  const r = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return ROUTES.includes(r) ? r : "compose";
}

// Tiny hash router: #/compose, #/drafts, #/insights.
export function useHashRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onHash = () => setRoute(current());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = useCallback((to) => {
    if (window.location.hash !== `#/${to}`) window.location.hash = `/${to}`;
    setRoute(to);
  }, []);
  return [route, navigate];
}
