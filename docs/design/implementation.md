# Resender redesign implementation

Branch: `codex/resender-desktop-redesign`.

## Design source

The private Claude Design artifact and submitted requirements are linked in [the brief](claude-design-brief.md). The downloaded [handoff](claude-design-spec.md) and [original token CSS](claude-tokens.css) are retained for reference. The live main reader, count expansion and inline reply were inspected before adapting the design to the real app.

## Implementation

- `src/design-tokens.css`: blue accent, neutral light/dark palettes, typography and semantic tokens. `src/index.css` maps the app's sidebar tokens and defines responsive layout/component rules.
- `Sidebar` and `ConnectedDomains`: compact sender identity, primary navigation, status icons, informational domains and a domain popover in the compact rail. A single domain component handles both layouts.
- `MailboxView`: compact rows, loading skeletons, retained-content errors, history footer, keyboard navigation, pointer/keyboard divider, Back-to-list focus restoration, and newly sent message selection. Compose replaces the reader while keeping the list on wide windows.
- `ConversationView`, `EmailBody`, `DeliveryStatus`, `ReplyEditor`: folded one-line previews, circular middle count with no adjacent separator, bordered open messages, readable body spacing, visible expanded delivery labels, compact reply and bottom send toolbar.
- `ComposeView`: compact field rows, bottom Send toolbar, inline accessible field validation including Cc/Bcc, Cmd/Ctrl+Enter and preserved fields on send failure.
- Settings, onboarding and startup share the new visual system. Tauri minimum width is 760px.

At 1200px and above the sidebar is 224px; from 900px it is 196px. Below 900px it becomes a 56px icon rail with one mailbox pane at a time. The divider uses one pixel constraint model (260–560px, keeping 380px for the reader), rather than applying an independent percentage cap that would break pointer/keyboard resizing.

## Intentional adaptations

The generated handoff contains proposed backend/storage behavior that is outside this visual redesign. The existing OS keychain/reveal flow, Rust API calls and background polling, strict `sandbox=""` email iframe, local reply-link storage, thread ancestry and draft lifecycle remain in place. No generated SQLite layer, sender identity selector, invented validation against domains, global shortcut system or new email action was introduced. Existing Formatted/Plain text alternatives and quoted history behavior remain intact.

Dark error foreground uses the light danger token; destructive button/badge backgrounds use the separate solid danger token. This corrects the generated token alias's insufficient dark text contrast.

## Review without real mail

Run `pnpm dev --port 1421`, then open [the synthetic review preview](http://localhost:1421/design-preview.html). Keep the normal Tauri server on port 1420.

The preview uses the real UI components with synthetic messages and isolated API replacements. It only runs in development on port 1421, is not imported by the production entry point, and is not included in the normal production bundle. Send, key update and disconnect actions in this preview never call Resend or the keychain. Its separate origin keeps review preferences separate from the desktop app.

Use the top controls to inspect window/1440/1100/800px widths, loading, empty, refresh-error and partial-history states. Use the sidebar to inspect Inbox, Sent, Compose, Settings and dark mode; use the Onboarding link for the connection screen.

## Verification

Regression coverage includes thread folding, consecutive replies and ancestry, retained failed drafts, sandboxed HTML, delivery status synchronization, list keyboard navigation, Back focus return, keyboard divider resizing, Compose recipient validation, failed-send preservation, Compose/list coexistence and new-message selection. Final checks: `pnpm test` passed 50 tests in 12 files; `pnpm build` passed; `cargo test --manifest-path src-tauri/Cargo.toml` passed 4 Rust tests. An independent read-only review found two issues (divider constraints and dark error contrast); both were fixed and checked by the reviewer. The local synthetic UI was inspected in light/dark and compact reader/reply/compose/settings views.

No real emails were sent, and no changes were merged or published.
