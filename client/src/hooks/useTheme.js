import { useCallback, useEffect, useState } from "react";

// Tone Radar is dark first: the instrument panel stays dark unless someone
// picks light, whatever the OS says. Stored as a raw string so the inline
// script in public/index.html can read it before React loads (avoids a
// flash of the wrong theme).
const KEY = "toneRadar.theme";
const THEME_COLOR = { dark: "#0e1013", light: "#f2f4f5" };

function readChoice() {
  try {
    return window.localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useTheme() {
  const [choice, setChoice] = useState(readChoice);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "light") root.dataset.theme = "light";
    else delete root.dataset.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[choice]);
    try {
      if (choice === "light") window.localStorage.setItem(KEY, "light");
      else window.localStorage.removeItem(KEY);
    } catch {
      // Storage unavailable; the theme still applies for this visit.
    }
  }, [choice]);

  const toggle = useCallback(() => setChoice((prev) => (prev === "light" ? "dark" : "light")), []);

  return { isDark: choice === "dark", toggle };
}
