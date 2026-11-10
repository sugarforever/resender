# Resender whole-app redesign

Submitted through Claude Design's supported prompt UI on 2026-11-10.

- [Design chat and artifact](https://claude.ai/chat/0d1f5ccb-cff1-4d55-9896-6c44d241d21d?artifact=8d98e121-8164-4437-b809-9a72452f2d8e)
- Observed workflow: `/artifacts/design` → Design → prompt chat with live artifact canvas. Optional design-system selection and attachments. Sharing indicated “Only you”.
- Initial response: “I’ll build the Resender prototype directly in your open Design artifact. I’m starting with the 7-message reading view, then adding the remaining screens, the state switcher, and the specs.”

## Submitted requirements

Build a coherent interactive desktop email application, not a marketing website. Audience: developers, founders and small teams using Resend. Compact, calm minimalism; readable sans typography; restrained accent; light/dark themes; efficient navigation and message list; generous reading area. Gmail interaction reference without literal copying. Responsive targets: 1440×900, 1100×760 and 800×640.

Inventory based on README and actual components:

1. Startup, connection/onboarding with masked Full access API key, reveal, validation, loading/error, OS-keychain explanation and API-key dashboard link.
2. Shared shell: Compose, Inbox/unread count, Sent, Settings, theme toggle, connected domain verification/loading/error/none/refresh, separate default sender identity. Domains are informational; mailboxes show all mail available to the API key.
3. Inbox/Sent: compact participant/subject/date/count rows, unread/selected/hover/focus, resizable reading pane, refresh/countdown, loading/empty/no selection/error, indexing/partial-history retry.
4. Conversation: subject, count, mixed inbound/outbound messages, sender/recipient/date, informational attachment badges, Formatted/Plain text, body loading/error/retry and missing inline-image notice.
5. Compose: From/To/optional Cc/Bcc/Subject/plain-text body/Send, validation, sending, preserved input on failure and success opens Sent.
6. Inline reply: recipient header, immediately visible writing area, optional expanded From/To/Cc/Bcc/Subject, attributed original quotation below separator with preview toggle, bottom Send/Discard, Cmd/Ctrl+Enter, failure preserves draft.
7. Settings: masked key update/reveal, disconnect confirmation, sender/save, poll interval minimum 30 seconds, light/dark, success/error feedback.

## Exact interactions

Newest message stays open while reading. First and previous remain visible folded. Middle messages hide behind a circular count with no long adjacent separator. Hover/focus replaces the number with up/down carets. Clicking removes the count and reveals all middle messages folded. Each folded message previews its first readable body line. Older headers toggle independently. Demonstrate 1-, 3- and 7-message threads.

Reply folds the source and opens a compact editor; discard restores latest reading. Consecutive replies retain recipient, quote latest sent message plus history, and preserve ancestry. Accessible status icons/tooltips distinguish queued, accepted/sent (unconfirmed), delivered to mail server, delays and failures; reduced-motion animation and sync errors. No unsupported certainty about read receipts.

## Boundaries

Tauri 2, React 19, TypeScript, Vite 7, Tailwind 4, shadcn/ui, lucide-react; Rust API calls and secure keychain stay intact. Sandboxed HTML with app sans defaults preserves authored styles. Message-ID/reply-header threads, latest 50 received + 50 sent history, device-local reply linkage. Inline drafts are not saved. Prototype actions use synthetic local state only.

Do not invent search, archive, mail deletion, labels, stars, snooze, AI summaries, multiple accounts, saved drafts, attachment downloading/uploading, rich composition, or unlimited pagination. Do not publish or send mail.

## Synthetic fixture

- Alex Morgan <alex@northstar.example>, verified northstar.example, pending updates.example.
- Maya Chen <maya@studio.example>, Jordan Lee <jordan@partner.example>.
- Seven-message “Launch checklist”: first “Here is the checklist for Thursday’s launch.” Middle copy review/staging/signoff. Previous “The staging checks passed. Can you confirm the final copy?” Latest Alex to Maya “The final copy is approved. We are ready for Thursday.”
- Other subjects: Invoice for October, Welcome to the beta, Quick question about the integration.

No real credentials, contacts, email bodies or personal screenshots were supplied.

## Requested deliverables

Clickable whole-app prototype with navigation, themes, thread expansion, reply/details/quote toggles, compose/settings/onboarding; separate demo-state switcher; exportable exact light/dark tokens, typography/spacing/radii, reusable component/state inventory, responsive/accessibility/keyboard rules and implementation handoff/source export. WCAG AA, semantic labels, visible focus, keyboard support and reduced motion.

## Review status

Claude completed the private 14-artboard prototype. The implementation handoff and token CSS were downloaded through the supported UI and saved as `claude-design-spec.md` and `claude-tokens.css`. The main reader, middle expansion, and inline reply were inspected in the live prototype. Local implementation and verification are recorded in `implementation.md`.
