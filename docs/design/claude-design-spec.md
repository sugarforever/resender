# Resender — Desktop Mail · Design specification & implementation handoff

Stack: Tauri 2 · React 19 · TypeScript · Vite 7 · Tailwind 4 · shadcn/ui · lucide-react.
Tokens: `resender-tokens.css` (Tailwind 4 `@theme` + shadcn aliases) and `resender-tokens.json` (DTCG format). Every value below comes from those files.

---

## 1. Principles

- **Calm, compact, readable.** 13/20 UI text, 15/24 email bodies, one blue accent, neutral surfaces, 1px borders. There is one card level only, the open message, and no gradients or illustrations.
- **The email body gets the space.** The reader can be up to 920px wide, body text is capped at 72ch, and the sidebar and list give way first.
- **Honest state.** Accepted is never shown as Delivered, opens and clicks are labeled as tracking signals, unread is a local reading state, and domains are for information only.
- **Nothing invented.** There's no search, archive, trash, labels, stars, snooze, AI summaries, multiple accounts, attachment downloads or saved drafts.

## 2. Layout & responsive rules

The app frame is the container (`container-type: inline-size`). Rules key off the window's inner width.

| Width | Sidebar | List | Reader | Notes |
|---|---|---|---|---|
| ≥ 1200 (e.g. 1440×900) | 224px, labels | 360px default, drag 260–560, max 44% | flex, inner max 920px, padding 16/28 | Three panes |
| 900–1199 (e.g. 1100×760) | 196px, labels | same drag range, max 36% | inner padding 14/20 | Three panes; folded name column 80–130px |
| < 900 (e.g. 800×640) | 56px icon rail; labels visually hidden, but they stay as accessible names and tooltips; unread becomes a badge | full width when nothing is open | full width when a conversation or Compose is open, with a Back button | Single pane. Domains move to a popover from the globe button. Message body indent drops to 0. Folded preview wraps to a second line |

Pane priority from highest to lowest: reader or compose, then list, then sidebar labels, then domain list.
Window minimum: 760×560, which you set in `tauri.conf.json`.

Settings replaces the list and reader at every width and centers in a 680px column.

## 3. Thread folding (must match exactly)

Messages are in chronological order, indexes 0…n−1.

```
n = 1        → [latest open]
n = 2        → [first folded] [latest open]
n = 3        → [first folded] [previous folded] [latest open]          (no count)
n ≥ 4        → [first folded] (count = n−3) [previous folded] [latest open]
after click  → all n−1 older messages as folded headers, latest open
```

- **Count.** A 28px circle in the avatar column with 1px border-strong, set in 12/600 tabular numerals. There's no horizontal rule next to it, and nothing else sits on that row.
- **Hover and focus.** On `:hover` and `:focus-visible`, the number is replaced by `ChevronsUpDown` (14px) and the fill becomes surface-2. The accessible name is "Show N earlier messages".
- **Click.** Expands the middle and the count disappears. The middle doesn't re-collapse until the conversation reloads.
- **Folded header.** A `<button aria-expanded="false">` laid out in a grid: avatar 28, name (600, 90–160px), preview (text-3, one line, ellipsis), then a right column with the outbound status icon and short date. Preview is the first non-empty line of the plain-text body that isn't a quote (`>`).
- **Toggling.** Each older header toggles open and closed on its own. The open older header's sender line is the collapse button.
- **Latest message.** Always open while reading, and its header doesn't toggle.
- **Reply.** Starting a reply from any open message folds that message and opens the inline editor below the thread. Discard brings the latest message back to reading state.

## 4. Inline reply

- **Header.** Shows "To" plus the recipient name and email, and a **Details** disclosure (`aria-expanded`, `aria-controls`). Details shows From (select of verified identities), To, Cc, Bcc and Subject (prefilled `Re: <subject>`), plus a meta line: In-Reply-To, References count, and "linkage kept on this device only".
- **Writing area.** Visible right away and focused when the editor opens. The textarea is 15/24 with a min height of 148px.
- **Quote.** Sits under a 1px separator: attribution "On Tue, Nov 10, 2026 at 9:14 AM, Name <email> wrote:", then a 2px border-strong quote line. It shows a 2-line preview by default with a "Show full quote" toggle. The full quote is the source message plus the previous message as `> ` history and an "N earlier messages" marker.
- **Toolbar.** Bottom bar on the bg color: primary **Send**, the hint "⌘↵ / Ctrl+Enter", and **Discard reply** as a ghost button. ⌘/Ctrl+Enter sends from anywhere inside the editor.
- **Recipients.** To defaults to the source's sender. If the source is your own message, To keeps its recipients, so consecutive replies stay with Maya.
- **Headers.** `In-Reply-To` = source Message-ID. `References` = the source's References plus the source Message-ID.
- **Send states.** While sending, the button shows "Sending…" with a spinner and is disabled. On failure, an inline `role="alert"` error appears and the draft stays intact. On success, the message is appended with status Sending, then Accepted, and the editor closes.
- **Drafts.** Not persisted. Leaving the conversation or mailbox discards the draft and shows the toast "Unsent reply discarded".

## 5. Compose

Compose replaces the reader. The list stays visible at ≥900 and is hidden below that.

- **Fields.** Rows are 40px with a bottom border: From select, To (with Cc and Bcc reveal links), optional Cc and Bcc, Subject, then the plain-text Message, which fills the remaining height.
- **Validation** runs on Send and is cleared per field on edit. Each message sits directly under its field, tinted danger-soft, with `aria-invalid` and `aria-describedby` on the field:
  - From domain pending or unknown
  - To empty or invalid (each comma or semicolon item; `Name <email>` is accepted)
  - Cc or Bcc invalid
  - Subject empty (Resend requires one)
  - Message empty
- **Send states.** Sending: "Sending…" with the button disabled. Error: a banner above the toolbar and every input preserved. Success: opens Sent with the new conversation selected, plus the toast "Sent to Resend — delivery not confirmed yet".
- **Content limits.** No rich text and no attachments, which the toolbar says plainly.

## 6. Delivery status vocabulary

Every status pairs an icon with a visible label in the open message header. List rows and folded headers show the icon only, with a visually hidden label and a tooltip. Color always comes with a distinct glyph and label.

| Status | lucide icon | Label | Tone | Meaning shown to the user |
|---|---|---|---|---|
| queued | `Clock` | Queued | muted | Queued on this device, not yet accepted by Resend |
| sending | `LoaderCircle` (spins; static under reduced motion) | Sending | muted | Handing the message to Resend |
| accepted | `Check` | Accepted | muted | Accepted by Resend; delivery isn't confirmed yet |
| delivered | `CheckCheck` | Delivered | success | Delivered to the recipient's mail server. **Not a read receipt** |
| delayed | `ClockAlert` | Delayed | warning | Recipient server deferred it; Resend is retrying |
| bounced | `MailX` | Bounced | danger | Recipient server rejected it |
| failed | `CircleAlert` | Failed | danger | Resend couldn't send |
| complained | `Flag` | Spam complaint | danger | Recipient reported it as spam |
| opened | `Eye` | Opened | muted | Tracked open; proxies and scanners can trigger it |
| clicked | `MousePointerClick` | Link clicked | muted | Tracked click; scanners can trigger it |
| sync failure | `RefreshCwOff` | Status not updated | warning | Couldn't refresh status; shows the last known state |

Incoming mail shows no status, only the local unread dot and bold styling.

## 7. Component & state inventory

| Component | States |
|---|---|
| Startup | "Reading your API key from the keychain…", then "Loading mailboxes…", then the app with list skeleton |
| Onboarding | idle · revealed · format error (immediate) · validating ("Verifying with Resend…") · sending-only key error · network error · disconnected notice |
| Sidebar | default · ≤1199 · rail. Nav item: default / hover / focus / current (`aria-current="page"`); Inbox unread count |
| Domains | loaded (verified ✓ / pending ◌ / failed ✕) · loading skeleton · error + Retry · none + link · refreshing (spin). Always captioned "for reference only" |
| Mailbox list | initial loading (6 skeleton rows) · loaded · refresh failed with content kept (danger banner + Retry) · empty (Inbox / Sent copy) · history indexing (progress 64/100) · partial history (warning banner + Retry) · footer "Showing the latest 50 …" |
| List row | default · hover · focus (inset ring) · selected · unread (dot + 600 weight) · sent (status icon) |
| Polling | "Next check m:ss" countdown · "Checking…" · "Retry in m:ss" after failure |
| Divider | idle (1px) · hover / drag / focus (3px accent) · keyboard ← → ±16px, Home / End |
| Reader | no selection · thread (1 / 2 / 3 / ≥4 / expanded) · back button < 900 |
| Message | folded · open · details open · body loading · body error + Retry · missing inline image notice · formatted / plain toggle (only when HTML exists) · attachments (informational badges, no download) |
| Inline reply | collapsed header · details open · quote preview / full · sending · error with draft kept · discard |
| Compose | empty · Cc / Bcc revealed · field errors · sending · send error · success → Sent |
| Settings | key replace (reveal, verify, ok, error) · disconnect confirm dialog · default sender save (ok, invalid, pending domain, unknown domain) · polling save (ok, < 30, > 3600) · theme Light / Dark |
| Toast | `role="status"` polite region, 3.8s, e.g. "Unsent reply discarded" |

## 8. Accessibility & keyboard

- **Contrast.** Every text token passes 4.5:1 on its own surfaces in both themes, including text-3 on selected rows (4.8 light, 4.7 dark). White on accent is 6.4 light and 5.0 dark.
- **Focus.** 2px focus ring with 2px offset. Rows and folded headers use an inset ring (−2px). Inputs use a ring plus a border-color change. Focus is never removed without a replacement.
- **Landmarks.**
  - `aside` for navigation, holding `nav[aria-label=Mailboxes]`
  - `section` for the conversation list
  - `main` for the conversation
  - `section[aria-label=Reply]`
  - `role="alertdialog"` with `aria-modal` for disconnect, with focus moved to Cancel and Esc to close
- **Real controls.** Rows, folded headers, the thread count and the divider are all `<button>` elements. Icon-only buttons have `aria-label` and a tooltip.
- **Keyboard map.**
  - Tab and Shift+Tab move between regions in source order.
  - In the list, ↑ and ↓ move focus, Home and End jump, Enter opens.
  - In the thread, Enter or Space toggles folded headers and reveals the count.
  - In reply and compose, ⌘/Ctrl+Enter sends. In the dialog, Esc cancels.
  - App-level shortcuts are Tauri menu accelerators, not global key listeners: ⌘/Ctrl+N Compose, ⌘/Ctrl+R Refresh, ⌘/Ctrl+, Settings.
- **Live regions.** Toasts are `polite`. Send, refresh and body errors are `role="alert"`. Indexing and partial history are `role="status"`. The polling countdown is not live, to avoid chatter.
- **Reduced motion.** `prefers-reduced-motion: reduce` stops the spinner rotation and skeleton pulse. Labels still say "Sending" and "Loading".
- **Status.** Never conveyed by color alone: always an icon plus a label or visually hidden text.

## 9. Implementation notes

**Boundary.** All Resend HTTP lives in Rust (`reqwest`). The web view only calls Tauri commands, for example:

```
connect(key) → Result<Account>           // validates Full access via GET /domains + received-emails list
disconnect()                             // deletes keyring entry only; never deletes Resend data
list_domains() → Vec<Domain>
list_mailbox(kind: Inbox|Sent) → Page    // latest 50 received / 50 sent; no unlimited pagination
get_message(id) → MessageBody            // html + text + attachment metadata
send(Outgoing) → SendResult              // plain text only; sets In-Reply-To / References
get_status(id) → DeliveryStatus
```

**Secrets.** The API key is stored with the `keyring` crate (macOS Keychain, Windows Credential Manager, Secret Service). The key is never returned to JS after it's saved; Settings shows only `re_••••••••••••<last4>`.

**Threading.** Group by `Message-ID`, `In-Reply-To` and `References` with union-find, never by subject. The local index (SQLite in the app data dir) stores:
- message → thread links
- reply ancestry for sent messages
- unread flags

This index lives on the device and is never synced.

**History indexing.** On first run, index up to 50 received plus 50 sent and show the indexing banner with progress. If some message bodies fail, show the partial-history banner with Retry.

**Polling.** Inbox only, every `pollEvery` seconds (minimum 30, default 60, persisted). Pause while the window is hidden. A failed refresh keeps the current list and shows the banner.

**Email rendering.**
- Render HTML in `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox">`, with no `allow-scripts` and no `allow-same-origin`, via `srcdoc`.
- Apply a strict CSP (`default-src 'none'; img-src data: cid: https:; style-src 'unsafe-inline'; font-src data: https:`).
- Inject a base stylesheet that sets the app sans at 15/24 and the mono font for `pre, code` only where the email doesn't specify its own, so authored fonts, colors and code blocks are respected.
- Rewrite links to `target=_blank`; Rust opens them in the system browser.
- Resize the iframe to its content height.
- Show the missing-image notice when a `cid:` reference has no matching inline part.

**Plain text.** Use `text` when present; otherwise derive it from the HTML in Rust. The Formatted/Plain toggle appears only when both exist.

**Drafts.** Kept in component state only. Navigating away discards them with a toast.

**Theme.** A `dark` class on `<html>`, persisted in app settings. The tokens file holds both palettes.

**shadcn mapping.**

| Element | Component and classes |
|---|---|
| Buttons | `Button` sizes sm (24), default (28), lg (36) |
| Inputs | `Input` (32) |
| Selects | `Select` |
| Segmented control | `ToggleGroup` |
| Dialog | `AlertDialog` |
| Tooltips | `Tooltip` |
| Toasts | `Sonner` |
| Rows | Plain buttons with `rounded-sm px-2.5 py-2 hover:bg-surface-2 data-[selected]:bg-selected` |
| Resizer | `ResizablePanelGroup`, keeping the keyboard behaviour above |

**Fixtures.** The default sender is Alex Morgan <alex@northstar.example>. Domains: northstar.example verified, updates.example pending. Contacts: Maya Chen <maya@studio.example>, Jordan Lee <jordan@partner.example>. The prototype uses only this synthetic data and never sends mail.
