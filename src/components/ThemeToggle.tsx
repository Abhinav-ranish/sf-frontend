"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  // The stored theme is only knowable client-side; render a neutral icon slot on the
  // server pass so the markup matches and hydration stays quiet.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const label = !hydrated
    ? "Toggle theme"
    : theme === "dark"
      ? "Switch to light mode"
      : "Switch to dark mode";

  return (
    <button
      onClick={toggle}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      aria-label={label}
      title={label}
    >
      {hydrated ? (
        theme === "dark" ? (
          <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} />
        ) : (
          <Moon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        )
      ) : (
        <span className="block h-[18px] w-[18px]" aria-hidden="true" />
      )}
    </button>
  );
}
