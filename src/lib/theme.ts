export const THEME_STORAGE_KEY = "ravenclaw-theme";
export const THEME_CHANGE_EVENT = "ravenclaw-theme-change";

export type ThemeMode = "light" | "dark";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function getSystemThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredThemeMode(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(saved) ? saved : null;
}

export function getThemeSnapshot(): ThemeMode {
  if (typeof document !== "undefined" && isThemeMode(document.documentElement.dataset.theme)) {
    return document.documentElement.dataset.theme;
  }
  return getStoredThemeMode() ?? getSystemThemeMode();
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

export function getThemeBootstrapScript() {
  return `
    (function () {
      try {
        var storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
        var saved = window.localStorage.getItem(storageKey);
        var mode = saved === "dark" || saved === "light"
          ? saved
          : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.dataset.theme = mode;
        document.documentElement.style.colorScheme = mode;
      } catch (error) {}
    })();
  `;
}
