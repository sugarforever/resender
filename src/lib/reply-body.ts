import type { Mail } from "./types";
import { toDate } from "./format";
import { EMAIL_FONT_FAMILY } from "./email-document";

export function quotedOriginal(mail: Mail): {
  attribution: string;
  content: string;
} {
  let content = mail.text?.trim() ?? "";
  if (!content && mail.html) {
    // Parse in a detached document; never render or copy active email markup.
    const template = document.createElement("template");
    template.innerHTML = mail.html;
    const fragment = template.content;
    fragment
      .querySelectorAll("script,style,template,noscript")
      .forEach((element) => element.remove());
    fragment
      .querySelectorAll("br")
      .forEach((element) => element.replaceWith("\n"));
    fragment
      .querySelectorAll("p,div,li,blockquote,tr,h1,h2,h3,h4,h5,h6")
      .forEach((element) => element.append("\n"));
    content = fragment.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";
  }
  const date = toDate(mail.created_at);
  const when = Number.isNaN(date.getTime())
    ? ""
    : `On ${date.toLocaleString()}, `;
  return {
    attribution: `${when}${mail.from} wrote:`,
    content: content || "[Original message has no readable text.]",
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

export function buildReplyBody(
  text: string,
  mail: Mail,
): { text: string; html: string } {
  const quote = quotedOriginal(mail);
  return {
    text: `${text}\n\n${quote.attribution}\n${quote.content
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n")}`,
    html: `<div style="font-family:${escapeHtml(EMAIL_FONT_FAMILY)};font-size:14px;line-height:1.6"><div style="white-space:pre-wrap">${escapeHtml(text)}</div><br><div>${escapeHtml(quote.attribution)}</div><blockquote style="margin:0 0 0 0.8em;border-left:2px solid #ccc;padding-left:1em;white-space:pre-wrap">${escapeHtml(quote.content)}</blockquote></div>`,
  };
}
