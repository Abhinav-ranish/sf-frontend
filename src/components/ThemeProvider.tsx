"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "app-theme";
const THEME_CHANGE_EVENT = "app-theme-change";
const DEFAULT_THEME: Theme = "dark";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: DEFAULT_THEME,
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
}

function subscribeToThemeChange(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(THEME_CHANGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(THEME_CHANGE_EVENT, handleChange);
  };
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useSyncExternalStore<Theme>(
    subscribeToThemeChange,
    readStoredTheme,
    () => DEFAULT_THEME,
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggle() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
