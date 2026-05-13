"use client";

import { useSyncExternalStore } from "react";
import {
  applyTheme,
  getStoredThemeMode,
  getSystemThemeMode,
  getThemeSnapshot,
  isThemeMode,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "@/lib/theme";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

  const handleThemeChange = (event: Event) => {
    const detail = (event as CustomEvent<ThemeMode>).detail;
    if (isThemeMode(detail)) applyTheme(detail);
    onStoreChange();
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== THEME_STORAGE_KEY) return;
    applyTheme(getStoredThemeMode() ?? getSystemThemeMode());
    onStoreChange();
  };

  const handleMediaQueryChange = () => {
    if (getStoredThemeMode()) return;
    applyTheme(getSystemThemeMode());
    onStoreChange();
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorage);
  mediaQuery?.addEventListener?.("change", handleMediaQueryChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorage);
    mediaQuery?.removeEventListener?.("change", handleMediaQueryChange);
  };
}

export function useThemeMode() {
  return useSyncExternalStore(subscribe, getThemeSnapshot, () => "light");
}

export function setThemeMode(mode: ThemeMode) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_CHANGE_EVENT, { detail: mode }));
  }
  applyTheme(mode);
}

export function toggleThemeMode() {
  setThemeMode(getThemeSnapshot() === "dark" ? "light" : "dark");
}
