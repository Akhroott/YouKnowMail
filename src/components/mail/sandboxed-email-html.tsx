"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeEmailHtml } from "@/lib/security/sanitize";

/**
 * Renders sanitized email HTML inside a sandboxed iframe so untrusted markup
 * never executes in the main application document.
 */
export function SandboxedEmailHtml({
  html,
  allowImages = true,
  className,
}: {
  html: string;
  allowImages?: boolean;
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);

  const srcDoc = useMemo(() => {
    const safe = sanitizeEmailHtml(html || "", { allowImages });
    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<base target="_blank" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    color: #171717;
    word-break: break-word;
  }
  a { color: #2563eb; }
  img { max-width: 100%; height: auto; border: 0; vertical-align: middle; }
  table { border-collapse: collapse; }
  pre, code { white-space: pre-wrap; }
</style>
</head><body>${safe}</body></html>`;
  }, [html, allowImages]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const resize = () => {
      try {
        const doc = iframe.contentDocument;
        const h = doc?.documentElement?.scrollHeight || doc?.body?.scrollHeight || 160;
        setHeight(Math.min(Math.max(h + 8, 120), 8000));
      } catch {
        /* srcDoc same-origin */
      }
    };

    iframe.addEventListener("load", resize);
    // Images loading later change height
    const t1 = window.setTimeout(resize, 300);
    const t2 = window.setTimeout(resize, 1200);
    resize();
    return () => {
      iframe.removeEventListener("load", resize);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      title="Email message"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      className={className}
      style={{
        width: "100%",
        height,
        border: 0,
        background: "#ffffff",
        borderRadius: 8,
      }}
    />
  );
}
