"use client";

import { useEffect } from "react";

export function MobileThemeSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkAndUpdateTheme = () => {
      const isMobile = window.innerWidth < 768;
      const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

      const root = document.documentElement;
      let metaThemeColor = document.querySelector('meta[name="theme-color"]');

      if (!metaThemeColor) {
        metaThemeColor = document.createElement("meta");
        metaThemeColor.setAttribute("name", "theme-color");
        document.head.appendChild(metaThemeColor);
      }

      if (isMobile && darkModeMediaQuery.matches) {
        root.classList.add("dark");
        metaThemeColor.setAttribute("content", "#090d16");
      } else if (isMobile && !darkModeMediaQuery.matches) {
        root.classList.remove("dark");
        metaThemeColor.setAttribute("content", "#f8fafc");
      }
    };

    checkAndUpdateTheme();

    window.addEventListener("resize", checkAndUpdateTheme);
    const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    darkModeMediaQuery.addEventListener("change", checkAndUpdateTheme);

    return () => {
      window.removeEventListener("resize", checkAndUpdateTheme);
      darkModeMediaQuery.removeEventListener("change", checkAndUpdateTheme);
    };
  }, []);

  return null;
}
