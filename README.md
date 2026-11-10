# Resender

A cross-platform desktop client for [Resend](https://resend.com), built with
Tauri, React, shadcn/ui, and lucide icons.

<p align="center"><em>Read, send, and get notified about your Resend email — from your desktop.</em></p>

## Features

- **Connected domains** — automatically lists your Resend domains and their
  verification status in the sidebar, separately from your default sender.
- **Secure API key storage** — your Resend key is kept in the OS-native keychain
  (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux),
  rather than persisted in plain text. Settings can retrieve it for display.
- **Read email** — browse your inbox (Resend Inbound) and sent mail, with a
  clean reading pane. HTML bodies render in a script-sandboxed iframe.
- **Send email** — compose with To/Cc/Bcc, a default sender, and inline validation.
- **Conversation threads** — related incoming and sent emails appear in a single
  stack. Older messages collapse; expand any message to read it or reply inline.
  Replies use `In-Reply-To` and `References` so recipients' email apps can
  recognize the conversation.
- **New-mail notifications** — Resender polls for inbound email on a configurable
  interval and raises a native system notification when something arrives.

## Architecture

- **Frontend**: Vite + React + TypeScript + Tailwind v4 + shadcn/ui + lucide-react.
- **Backend**: Rust (Tauri v2). **All Resend API calls go through Rust** using
  `reqwest`; API authentication happens in Rust and avoids browser CORS issues.
- **Key storage**: the `keyring` crate (`src-tauri/src/keychain.rs`).
- **Resend client**: `src-tauri/src/resend.rs` — centralizes auth, and translates
  Resend `429` rate-limit / quota responses into friendly messages.

### Resend endpoints used

| Feature       | Endpoint                        |
| ------------- | ------------------------------- |
| Send          | `POST /emails`                  |
| List sent     | `GET /emails`                   |
| Read sent     | `GET /emails/{id}`              |
| List domains  | `GET /domains`                  |
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

## Conversations and replies

Open a conversation in Inbox or Sent, expand a message, and click **Reply**.
The source message collapses into its header, leaving a compact reply editor
with the recipient at the top and the writing area directly underneath. Expand
the recipient row to edit From, To, Cc, Bcc, or Subject. The editor uses the
original Reply-To address when
available, your default sender (or the original receiving address), and the
existing subject. Sending adds the reply to the same stack; **Discard reply** closes
the editor. A failed send keeps your draft for retrying. The quoted original
appears below a divider, with an attribution and quote line, and is included in
both the plain-text and HTML email. You can hide its preview while writing.

Threads are linked by email Message-ID and reply headers, not subject matching.
The current history window contains the latest 50 received and 50 sent messages;
older messages outside that window are not fetched. Conversation grouping fills
in as message details load. Loading is paced and cached in memory for the session.

Resend does not document returning custom reply headers on sent-email retrieval.
Resender therefore stores reply links for emails it sends in local storage on
this device (up to 1,000 links), without storing bodies or API keys there. These
links survive restarts but do not sync to another device. Replies sent elsewhere
may appear separately until received references connect them. If the original
email has no Message-ID, the app warns that the recipient may see a separate
conversation. Switching conversations or leaving the mailbox discards an unsent
inline draft; drafts are not saved.

## Checks

```bash
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
```
