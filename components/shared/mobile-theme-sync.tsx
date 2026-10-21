"use client";

import { useEffect } from "react";

export function MobileThemeSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkAndUpdateTheme = () => {
      const storedTheme = localStorage.getItem("theme");
      const root = document.documentElement;
      let metaThemeColor = document.querySelector('meta[name="theme-color"]');

      if (!metaThemeColor) {
        metaThemeColor = document.createElement("meta");
        metaThemeColor.setAttribute("name", "theme-color");
        document.head.appendChild(metaThemeColor);
      }

      if (storedTheme === "light") {
        root.classList.remove("dark");
        metaThemeColor.setAttribute("content", "#f8fafc");
        return;
      }

      if (storedTheme === "dark") {
        root.classList.add("dark");
        metaThemeColor.setAttribute("content", "#090d16");
        return;
      }

      // Se for "system" ou indefinido, sincroniza com prefers-color-scheme
      const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      if (darkModeMediaQuery.matches) {
        root.classList.add("dark");
        metaThemeColor.setAttribute("content", "#090d16");
      } else {
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

