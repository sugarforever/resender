import { expect, it } from "vitest";
import { buildReplyBody, quotedOriginal } from "./reply-body";
import type { Mail } from "./types";

const original: Mail = {
  id: "original",
  from: "Person <person@example.com>",
  to: ["me@example.com"],
  subject: "Greeting",
  text: "How are you?\nSecond line.",
  created_at: "2026-11-10T09:00:00Z",
};

it("sends the new message first and quotes the original underneath in text and HTML", () => {
  const body = buildReplyBody("Fine, thanks.\nSee you!", original);
  expect(body.text).toMatch(/^Fine, thanks\.\nSee you!/);
  expect(body.text).toContain("Person <person@example.com> wrote:");
  expect(body.text).toContain("> How are you?\n> Second line.");
  expect(body.html).toContain("<blockquote");
  expect(body.html.indexOf("Fine, thanks.")).toBeLessThan(
    body.html.indexOf("How are you?"),
  );
  expect(body.html).toContain("&lt;person@example.com&gt;");
  expect(body.html).toContain("font-family:");
});

it("quotes readable HTML-only emails without copying scripts, active markup, or tracking images", () => {
  const mail = {
    ...original,
    text: undefined,
    html: '<style>secret css</style><script>evil()</script><p>Hello &amp; welcome</p><div>Next<br>line</div><img src="https://tracker.example.com/open" onerror="evil()">',
  };
  const quote = quotedOriginal(mail);
  expect(quote.content).toContain("Hello & welcome");
  expect(quote.content).toContain("Next\nline");
  expect(quote.content).not.toContain("evil()");
  const body = buildReplyBody('<img src=x onerror="bad()">', mail);
  expect(body.html).not.toMatch(
    /<script|<img|secret css|tracker\.example\.com/,
  );
  expect(body.html).toContain("&lt;img");
});
