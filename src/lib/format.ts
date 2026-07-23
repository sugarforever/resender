import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";

/** Parse `Name <email@x.com>` into its display name and address. */
export function parseAddress(input: string): { name: string; email: string } {
  if (!input) return { name: "", email: "" };
  const match = input.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].replace(/^"|"$/g, "").trim(), email: match[2].trim() };
  }
  return { name: "", email: input.trim() };
}

/** A short, human display label for a sender/recipient string. */
export function displayName(input: string): string {
  const { name, email } = parseAddress(input);
  return name || email;
}

/** Deterministic, theme-agnostic avatar color derived from an address. */
export function avatarStyle(input: string): {
  backgroundColor: string;
  color: string;
} {
  const { email, name } = parseAddress(input);
  const src = (email || name || "?").toLowerCase();
  let hue = 0;
  for (let i = 0; i < src.length; i++) {
    hue = (hue * 31 + src.charCodeAt(i)) % 360;
  }
  // Mid-tone chroma reads well on both light and dark backgrounds.
  return {
    backgroundColor: `oklch(0.62 0.12 ${hue})`,
    color: "oklch(0.99 0 0)",
  };
}

export function initials(input: string): string {
  const { name, email } = parseAddress(input);
  const source = name || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Parse a Resend timestamp. Resend returns Postgres-style strings like
 * `2026-04-03 22:13:42.674981+00` (space separator, microseconds, 2-digit
 * offset). V8 tolerates that, but WKWebView's JavaScriptCore does not and
 * returns Invalid Date — so we normalize to strict ISO 8601 first.
 */
export function toDate(input?: string): Date {
  if (!input) return new Date(NaN);
  let s = input.trim().replace(" ", "T");
  // Trim fractional seconds to milliseconds (3 digits).
  s = s.replace(/(\.\d{3})\d+/, "$1");
  // Normalize trailing timezone: +HH / +HHMM / +HH:MM -> +HH:MM.
  s = s.replace(
    /([+-]\d{2}):?(\d{2})?$/,
    (_m, hh: string, mm?: string) => `${hh}:${mm ?? "00"}`
  );
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date(input) : d;
}

/** Compact timestamp for list rows. */
export function shortDate(iso: string): string {
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) return format(d, "MMM d");
  return format(d, "MMM d, yyyy");
}

/** Full timestamp for the reading pane. */
export function fullDate(iso: string): string {
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${format(d, "PPpp")} · ${formatDistanceToNowStrict(d, {
    addSuffix: true,
  })}`;
}

export function joinAddresses(list?: string[]): string {
  if (!list || list.length === 0) return "";
  return list.map(displayName).join(", ");
}

/** Split a comma/semicolon/newline-separated address field into clean entries. */
export function parseAddressList(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate an address that may be `Name <email>` or a bare address. */
export function isValidAddress(input: string): boolean {
  const { email } = parseAddress(input);
  return EMAIL_RE.test(email);
}
