import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";

let cached: boolean | null = null;

/**
 * Ensure OS notification permission is granted (requested once, cached).
 * The background poller sends notifications from Rust, but the OS still needs
 * the app to hold notification permission — which this prompt secures.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (cached !== null) return cached;
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  cached = granted;
  return granted;
}
