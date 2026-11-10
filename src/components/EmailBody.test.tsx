import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailBody } from "./EmailBody";
import { buildEmailDocument, EMAIL_FONT_FAMILY } from "@/lib/email-document";

afterEach(cleanup);

it("adds a sans-serif fallback before authored styles without overriding explicit fonts", () => {
  const html =
    '<!doctype html><html><head><style>body{font-family:Georgia}</style></head><body style="font-size:18px"><p>Styled email</p><pre>Code stays monospace</pre></body></html>';
  const result = buildEmailDocument(html);
  const document = new DOMParser().parseFromString(result, "text/html");
  expect(document.head.firstElementChild?.textContent).toContain(
    EMAIL_FONT_FAMILY,
  );
  expect(document.head.lastElementChild?.textContent).toContain(
    "font-family:Georgia",
  );
  expect(document.body.style.fontSize).toBe("18px");
  expect(result).not.toContain("!important");
  expect(document.querySelectorAll("body")).toHaveLength(1);
});

it("lets multipart/alternative messages switch between formatted and literal plain text", async () => {
  const user = userEvent.setup();
  render(
    <EmailBody
      html="<p>Formatted alternative</p>"
      text={"Plain alternative\n<script>not markup</script>"}
    />,
  );
  expect(screen.getByTitle("Email content").getAttribute("sandbox")).toBe("");
  await user.click(screen.getByRole("tab", { name: "Plain text" }));
  expect(screen.getByText(/Plain alternative/).textContent).toContain(
    "<script>not markup</script>",
  );
  expect(screen.queryByTitle("Email content")).toBeNull();
  await user.click(screen.getByRole("tab", { name: "Formatted" }));
  expect(screen.getByTitle("Email content").getAttribute("srcdoc")).toContain(
    "Formatted alternative",
  );
});

it("falls back for empty HTML, null alternatives, and attachment-only messages", () => {
  const { rerender } = render(
    <EmailBody html={" \n"} text="Only plain text" />,
  );
  expect(screen.getByText("Only plain text")).toBeTruthy();
  expect(screen.queryByRole("tablist")).toBeNull();
  rerender(<EmailBody html={null} text={null} />);
  expect(
    screen.getByText("This email has no content to display."),
  ).toBeTruthy();
});

it("preserves related inline images and flags unresolved cid references", () => {
  const data = "data:image/png;base64,aGVsbG8=";
  const { rerender } = render(
    <EmailBody html={`<img src="${data}">`} htmlFormat="data_uri" />,
  );
  expect(screen.getByTitle("Email content").getAttribute("srcdoc")).toContain(
    data,
  );
  rerender(<EmailBody html='<img src="cid:logo">' htmlFormat="cid" />);
  expect(screen.getByRole("status").textContent).toContain("inline images");
});

it("prefers plain text when the HTML alternative contains only empty wrappers or nonvisual code", () => {
  render(
    <EmailBody
      html="<html><head><style>body{color:red}</style></head><body><div><br></div><script>hidden()</script></body></html>"
      text="Readable alternative"
    />,
  );
  expect(screen.getByText("Readable alternative")).toBeTruthy();
  expect(screen.queryByTitle("Email content")).toBeNull();
});
