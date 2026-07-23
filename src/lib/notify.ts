import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { displayName } from "./format";
import type { ReceivedEmail } from "./types";

let cached: boolean | null = null;

/** Ensure OS notification permission, requesting it once and caching the result. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (cached !== null) return cached;
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  cached = granted;
  return granted;
}

/** Fire a system notification summarizing newly arrived emails. */
export async function notifyNewEmails(emails: ReceivedEmail[]): Promise<void> {
  if (emails.length === 0) return;
  if (!(await ensureNotificationPermission())) return;

  if (emails.length === 1) {
    const e = emails[0];
    sendNotification({
      title: `New email from ${displayName(e.from)}`,
      body: e.subject || "(no subject)",
    });
  } else {
    sendNotification({
      title: `${emails.length} new emails`,
      body: emails
        .slice(0, 3)
        .map((e) => e.subject || "(no subject)")
        .join(" · "),
    });
  }
}
