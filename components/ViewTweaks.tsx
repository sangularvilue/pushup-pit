"use client";

import { useEffect, useState } from "react";

type Theme = "board" | "paper";
type Density = "cozy" | "compact";

/** Theme + density toggles. Persisted to localStorage; applied via <html data-*>. */
export default function ViewTweaks() {
  const [theme, setTheme] = useState<Theme>("board");
  const [density, setDensity] = useState<Density>("cozy");

  useEffect(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as Theme) || "board");
    setDensity((document.documentElement.getAttribute("data-density") as Density) || "cozy");
  }, []);

  function apply(nextTheme: Theme, nextDensity: Density) {
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.setAttribute("data-density", nextDensity);
    try {
      localStorage.setItem("pp-theme", nextTheme);
      localStorage.setItem("pp-density", nextDensity);
    } catch {}
    setTheme(nextTheme);
    setDensity(nextDensity);
  }

  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      <button
        className="btn btn-ghost"
        style={{ padding: "5px 9px", fontSize: 11 }}
        title={theme === "board" ? "Switch to day paper theme" : "Switch to board night theme"}
        onClick={() => apply(theme === "board" ? "paper" : "board", density)}
      >
        {theme === "board" ? "☀ day" : "☾ night"}
      </button>
      <button
        className="btn btn-ghost"
        style={{ padding: "5px 9px", fontSize: 11 }}
        title={density === "cozy" ? "Switch to compact density" : "Switch to cozy density"}
        onClick={() => apply(theme, density === "cozy" ? "compact" : "cozy")}
      >
        {density === "cozy" ? "▤ compact" : "▦ cozy"}
      </button>
    </span>
  );
}
