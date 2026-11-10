# Conversation threading implementation plan

**Goal:** Stack related received and sent messages, collapse older messages, and reply inline with standards-based threading headers.

**Architecture:** Join messages by RFC Message-ID, In-Reply-To, and References, never by subject alone. Hydrate the current 50-message inbox and sent windows through Rust, cache details in memory, and retain only outgoing reply links locally because Resend does not document returning sent custom headers. Keep the existing new-message composer.

**Constraints:** Do not expose API keys or send test email. Preserve the existing domain changes in a separate commit. Use the current checkout so the running desktop app picks up changes.

## Tasks

- [x] Add failing tests for reply recipient/sender selection, reference chains, missing headers, and grouping across directions without subject collisions.
- [x] Implement typed header metadata, grouping, local outgoing-link storage, and Rust header forwarding with validation tests.
- [x] Add a cached, paced detail loader and stack messages in the reading pane. Keep failed messages retryable and cancel stale account loads.
- [x] Add inline reply/cancel/send behavior and preserve the conversation after sending. Test collapse, send failure, and successful reply payloads.
- [ ] Document the current history window and local-link limitation. Run frontend tests/build, Rust tests, and diff checks. Request independent review, address findings, and open a GitHub PR.

## Review focus

- Same subjects from unrelated senders must remain separate.
- Missing Message-ID must not become a fabricated reply relationship.
- Reply-To and named recipient addresses must be respected.
- Failed send must retain the draft; switching threads must not reuse another thread's draft.
- Background hydration must not erase an inline draft or mix accounts.

## Validation

23 frontend tests and four Rust tests pass. Production build, Rust formatting, and whitespace checks pass. Independent review found a stale-account poll race, now covered by a regression test and fixed; re-review found no remaining important issues. No real emails were sent during validation.
