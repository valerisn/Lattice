"use client";

import { useState, useSyncExternalStore } from "react";

const query = "(max-width: 850px)";
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

export function useResponsiveSidebar() {
  const mobile = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  return {
    mobile,
    sidebar: mobile ? mobileOpen : desktopOpen,
    setSidebar: mobile ? setMobileOpen : setDesktopOpen,
  };
}
