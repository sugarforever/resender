# Resender

A cross-platform desktop client for [Resend](https://resend.com), built with
Tauri, React, shadcn/ui, and lucide icons.

<p align="center"><em>Read, send, and get notified about your Resend email — from your desktop.</em></p>

## Features

- **Secure API key storage** — your Resend key is kept in the OS-native keychain
  (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux),
  never in plain text or the webview.
- **Read email** — browse your inbox (Resend Inbound) and sent mail, with a
  clean reading pane. HTML bodies render in a script-sandboxed iframe.
- **Send email** — compose with To/Cc/Bcc, a default sender, and inline validation.
- **New-mail notifications** — Resender polls for inbound email on a configurable
  interval and raises a native system notification when something arrives.

## Architecture

- **Frontend**: Vite + React + TypeScript + Tailwind v4 + shadcn/ui + lucide-react.
- **Backend**: Rust (Tauri v2). **All Resend API calls go through Rust** using
  `reqwest`, so the API key never enters the webview and there are no CORS issues.
- **Key storage**: the `keyring` crate (`src-tauri/src/keychain.rs`).
- **Resend client**: `src-tauri/src/resend.rs` — centralizes auth, and translates
  Resend `429` rate-limit / quota responses into friendly messages.

### Resend endpoints used

| Feature       | Endpoint                        |
| ------------- | ------------------------------- |
| Send          | `POST /emails`                  |
| List sent     | `GET /emails`                   |
| Read sent     | `GET /emails/{id}`              |
| List received | `GET /emails/receiving`         |
| Read received | `GET /emails/receiving/{id}`    |

> **Note:** Reading requires a **Full access** API key. Inbound (received) email
> requires Resend's Inbound feature to be configured for your domain. Sending is
> limited by your plan's quota (free plan: 100/day, 3,000/month). Resend allows
> 10 requests/second per team — the default 60s poll is comfortably within that.

## Development

```bash
pnpm install
pnpm tauri dev      # run the desktop app in dev mode
pnpm tauri build    # produce a distributable bundle
```

Requirements: Node, Rust, and the platform
[Tauri prerequisites](https://tauri.app/start/prerequisites/).

## First run

1. Launch the app.
2. Paste a Resend **Full access** API key (get one at
   <https://resend.com/api-keys>). It's validated, then stored in your keychain.
3. Set a default "From" address (a domain you've verified in Resend) under
   **Settings** to prefill the composer.
