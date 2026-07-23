import { invoke } from "@tauri-apps/api/core";
import type {
  ListResponse,
  ReceivedEmail,
  SendEmailInput,
  SendResult,
  SentEmail,
} from "./types";

/**
 * Typed wrapper around the Rust commands. Every Resend call is proxied through
 * the backend so the API key never enters the webview.
 */
export const api = {
  hasApiKey: () => invoke<boolean>("has_api_key"),
  revealApiKey: () => invoke<string | null>("reveal_api_key"),
  saveApiKey: (key: string) => invoke<void>("save_api_key", { key }),
  deleteApiKey: () => invoke<void>("delete_api_key"),

  sendEmail: (input: SendEmailInput) =>
    invoke<SendResult>("send_email", { input }),

  listReceived: (limit = 50, after?: string) =>
    invoke<ListResponse<ReceivedEmail>>("list_received", { limit, after }),
  getReceived: (id: string) => invoke<ReceivedEmail>("get_received", { id }),

  listSent: (limit = 50) =>
    invoke<ListResponse<SentEmail>>("list_sent", { limit }),
  getSent: (id: string) => invoke<SentEmail>("get_sent", { id }),
};

/** Normalize an invoke rejection (always a string from our commands) to a message. */
export function errMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}
