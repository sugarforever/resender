import { useId, useMemo, useState } from "react";
import {
  buildEmailDocument,
  EMAIL_FONT_FAMILY,
  hasRenderableHtml,
} from "@/lib/email-document";

export function EmailBody({
  html,
  text,
}: {
  html?: string | null;
  text?: string | null;
  htmlFormat?: "data_uri" | "cid";
}) {
  const id = useId();
  const [mode, setMode] = useState<"html" | "text">("html");
  const hasHtml = useMemo(() => hasRenderableHtml(html), [html]);
  const hasText = !!text?.trim();
  const alternatives = hasHtml && hasText;
  const formatted = hasHtml && (mode === "html" || !hasText);
  const fontFamily =
    getComputedStyle(document.body).fontFamily || EMAIL_FONT_FAMILY;
  const documentHtml = useMemo(
    () => (html?.trim() ? buildEmailDocument(html, fontFamily) : ""),
    [html, fontFamily],
  );
  const unresolvedImages =
    formatted && /\b(?:src|href)\s*=\s*["']?cid:/i.test(html ?? "");
  return (
    <div className="email-body border-t">
      {alternatives && (
        <div
          role="tablist"
          aria-label="Email body format"
          className="flex gap-1 border-b px-4 py-2"
        >
          {(["html", "text"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`${id}-${value}`}
              aria-selected={mode === value}
              aria-controls={`${id}-body`}
              tabIndex={mode === value ? 0 : -1}
              onClick={() => setMode(value)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "html"
                    : event.key === "End"
                      ? "text"
                      : mode === "html"
                        ? "text"
                        : "html";
                setMode(next);
                document.getElementById(`${id}-${next}`)?.focus();
              }}
              className={`rounded px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-ring cursor-pointer ${mode === value ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
            >
              {value === "html" ? "Formatted" : "Plain text"}
            </button>
          ))}
        </div>
      )}
      <div
        id={`${id}-body`}
        role={alternatives ? "tabpanel" : undefined}
        aria-labelledby={alternatives ? `${id}-${mode}` : undefined}
      >
        {unresolvedImages && (
          <p role="status" className="text-muted-foreground px-4 py-2 text-xs">
            Some inline images could not be embedded in this email.
          </p>
        )}
        {formatted ? (
          <iframe
            sandbox=""
            title="Email content"
            className="h-80 w-full resize-y bg-white"
            srcDoc={documentHtml}
          />
        ) : (
          <pre className="email-text p-4 font-sans text-sm leading-[1.6] break-words whitespace-pre-wrap">
            {hasText ? text : "This email has no content to display."}
          </pre>
        )}
      </div>
    </div>
  );
}
