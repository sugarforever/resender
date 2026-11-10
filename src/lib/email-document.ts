export const EMAIL_FONT_FAMILY =
  '"Inter", ui-sans-serif, system-ui, -apple-system, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export function hasRenderableHtml(html?: string | null): boolean {
  if (!html?.trim()) return false;
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content
    .querySelectorAll("script,style,template,noscript")
    .forEach((element) => element.remove());
  return (
    !!template.content.textContent?.trim() ||
    !!template.content.querySelector("img,svg,video,audio,canvas,object,iframe")
  );
}

export function buildEmailDocument(
  html: string,
  fontFamily = EMAIL_FONT_FAMILY,
): string {
  const email = new DOMParser().parseFromString(html, "text/html");
  const defaults = email.createElement("style");
  // Low specificity and first in the head: sender-provided typography wins.
  defaults.textContent = `
    :where(body) { font-family: ${fontFamily}; font-size: 14px; line-height: 1.6; margin: 0; padding: 16px; color: #222; background: #fff; overflow-wrap: anywhere; }
    :where(pre,code,kbd,samp) { font-family: ui-monospace, "SF Mono", "Menlo", monospace; }
  `;
  email.head.prepend(defaults);
  return `<!doctype html>${email.documentElement.outerHTML}`;
}
