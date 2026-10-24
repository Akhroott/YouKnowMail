import DOMPurify from "isomorphic-dompurify";

/** Tags commonly used by marketing / transactional email templates. */
const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "caption",
  "center",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "figcaption",
  "figure",
  "font",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "small",
  "span",
  "strike",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const ALLOWED_ATTR = [
  "abbr",
  "align",
  "alt",
  "axis",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "char",
  "charoff",
  "class",
  "color",
  "colspan",
  "dir",
  "face",
  "height",
  "href",
  "hspace",
  "id",
  "lang",
  "name",
  "nowrap",
  "rel",
  "role",
  "rowspan",
  "scope",
  "size",
  "span",
  "src",
  "start",
  "style",
  "summary",
  "target",
  "title",
  "type",
  "valign",
  "vspace",
  "width",
];

function isDangerousCss(value: string): boolean {
  return /expression\s*\(|url\s*\(\s*['"]?\s*javascript:|url\s*\(\s*['"]?\s*data:|behavior\s*:|-moz-binding|@import|javascript\s*:/i.test(
    value
  );
}

function sanitizeInlineStyle(style: string): string {
  if (!style) return "";
  return style
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isDangerousCss(part))
    .join("; ");
}

/**
 * Sanitize HTML email content for safe iframe rendering.
 * Keeps layout styles/tables/images so templates render; blocks scripts and unsafe URLs.
 */
export function sanitizeEmailHtml(
  html: string,
  options: { allowImages?: boolean } = {}
): string {
  const allowImages = options.allowImages !== false;

  const tags = allowImages
    ? ALLOWED_TAGS
    : ALLOWED_TAGS.filter((t) => t !== "img");
  const attrs = allowImages
    ? ALLOWED_ATTR
    : ALLOWED_ATTR.filter((a) => a !== "src" && a !== "alt");

  // Hook once per call — isomorphic-dompurify shares a purify instance
  DOMPurify.removeAllHooks();
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style" && typeof data.attrValue === "string") {
      data.attrValue = sanitizeInlineStyle(data.attrValue);
    }
    if (data.attrName === "href" || data.attrName === "src") {
      const v = String(data.attrValue || "").trim().toLowerCase();
      if (v.startsWith("javascript:") || v.startsWith("vbscript:")) {
        data.keepAttr = false;
      }
      if (data.attrName === "src" && v.startsWith("data:")) {
        // Block data: URIs in images (tracking / XSS vectors)
        data.keepAttr = false;
      }
    }
    if (data.attrName === "background") {
      if (!allowImages) {
        data.keepAttr = false;
      } else {
        const v = String(data.attrValue || "").trim().toLowerCase();
        if (v.startsWith("javascript:") || v.startsWith("data:")) {
          data.keepAttr = false;
        }
      }
    }
  });

  const purify = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: allowImages ? [...attrs, "background"] : attrs,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
      "link",
      "meta",
      "base",
      "svg",
      "math",
      "video",
      "audio",
      "source",
      "track",
    ],
    FORBID_ATTR: [
      "onerror",
      "onload",
      "onclick",
      "onmouseover",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit",
    ],
  });

  DOMPurify.removeAllHooks();

  return purify
    .replace(/href\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, 'href="#"')
    .replace(/href\s*=\s*(['"])\s*data:[^'"]*\1/gi, 'href="#"')
    .replace(/<a\b([^>]*)>/gi, (_match, a: string) => {
      const safeAttrs = a
        .replace(/\s*target\s*=\s*(['"])[^'"]*\1/gi, "")
        .replace(/\s*rel\s*=\s*(['"])[^'"]*\1/gi, "");
      return `<a${safeAttrs} target="_blank" rel="noopener noreferrer nofollow">`;
    });
}
