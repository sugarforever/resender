/**
 * Non-sensitive user preferences, persisted in localStorage.
 * (The API key lives in the OS keychain, never here.)
 */

const KEYS = {
  defaultFrom: "resender.defaultFrom",
  pollInterval: "resender.pollIntervalSec",
  theme: "resender.theme",
} as const;

export type Theme = "light" | "dark";

export const MIN_POLL_SEC = 30;

export function getDefaultFrom(): string {
  return localStorage.getItem(KEYS.defaultFrom) ?? "";
}
export function setDefaultFrom(v: string) {
  localStorage.setItem(KEYS.defaultFrom, v.trim());
}

export function getPollInterval(): number {
  const raw = Number(localStorage.getItem(KEYS.pollInterval));
  if (!Number.isFinite(raw) || raw <= 0) return 60;
  return Math.max(MIN_POLL_SEC, Math.round(raw));
}
export function setPollInterval(seconds: number) {
  localStorage.setItem(
    KEYS.pollInterval,
    String(Math.max(MIN_POLL_SEC, Math.round(seconds)))
  );
}

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEYS.theme);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
export function setTheme(theme: Theme) {
  localStorage.setItem(KEYS.theme, theme);
}
