"use client";
import { useEffect, useSyncExternalStore } from "react";
const subscribe = (callback: () => void) => { window.addEventListener("lattice-theme",callback); return () => window.removeEventListener("lattice-theme",callback); };
const snapshot = () => localStorage.getItem("lattice-theme") || "system";
export function ThemePicker() {
  const theme = useSyncExternalStore(subscribe,snapshot,() => "system");
  useEffect(() => { const media = matchMedia("(prefers-color-scheme: dark)"); const apply = () => { document.documentElement.dataset.theme = theme === "system" ? media.matches ? "dark" : "light" : theme; }; apply(); media.addEventListener("change",apply); return () => media.removeEventListener("change",apply); }, [theme]);
  return <label className="theme-picker"><span>Appearance</span><select aria-label="Appearance" value={theme} onChange={e => { localStorage.setItem("lattice-theme",e.target.value); window.dispatchEvent(new Event("lattice-theme")); }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}
