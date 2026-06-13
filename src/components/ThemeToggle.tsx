"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Resolve the active theme once on mount from client-only sources
    // (the inline no-flash script may already have set data-theme).
    const stored = localStorage.getItem("memoria-theme") as Theme | null;
    const resolved: Theme =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync with client-only theme state
    setTheme(resolved);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("memoria-theme", next);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle compline (dark) mode"
      className="rounded-full border border-hairline px-3 py-1.5 text-sm text-ink-soft transition-colors hover:text-gold hover:border-gold/40"
    >
      {theme === "dark" ? "☾ Compline" : "☀ Daylight"}
    </button>
  );
}
