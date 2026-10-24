/** Central brand + app configuration for the YoyKnowMail frontend. */

export const APP_NAME = "YoyKnowMail";
export const APP_TAGLINE = "Modern, secure, receive-only email";
export const APP_DESCRIPTION =
  "YoyKnowMail (also known as YoyKnow Mail or Yoyknow) is a private receive-only email platform for verification codes and account security messages. Each account owns one private mailbox at yoyknowmail.com; customers never send mail.";
export const APP_DOMAIN = "yoyknowmail.com";
export const APP_URL = `https://${APP_DOMAIN}`;
export const APP_SUPPORT_EMAIL = `support@${APP_DOMAIN}`;

/** Brand search phrases for metadata / structured data */
export const APP_KEYWORDS = [
  "YoyKnowMail",
  "YoyKnow Mail",
  "YoyKnow",
  "Yoyknow",
  "yoyknow mail",
  "yoyknowmail",
  "yoyknowmail.com",
  "receive-only email",
  "private mailbox",
  "verification email inbox",
  "secure inbox",
] as const;

/** Mail domains offered when provisioning mailboxes (UI). */
export const DOMAINS = [APP_DOMAIN] as const;

export const BRAND = {
  name: APP_NAME,
  tagline: APP_TAGLINE,
  description: APP_DESCRIPTION,
  domain: APP_DOMAIN,
  url: APP_URL,
  supportEmail: APP_SUPPORT_EMAIL,
} as const;

/**
 * Browser-facing API base (live FastAPI app only — no mock mode).
 *
 * Same-origin proxy (preferred for cookies):
 *   NEXT_PUBLIC_API_BASE_URL=/api/backend
 *   API_PROXY_TARGET=https://mail.yoyknowmail.com
 *
 * Direct cross-origin:
 *   NEXT_PUBLIC_API_BASE_URL=https://mail.yoyknowmail.com
 *   (backend FRONTEND_ORIGINS + SameSite=None; Secure required)
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

export const BULK_MAILBOX_LIMIT = 100;
export const DEFAULT_PAGE_SIZE = 20;
export const CSRF_COOKIE_NAME = "ykm_csrf";
export const CSRF_HEADER_NAME = "X-CSRF-Token";
/** Inbox polling while the tab is visible (15–30s range). */
export const INBOX_POLL_MS = 20_000;

export const DEFAULT_PREFERENCES = {
  theme: "system" as const,
  dateTimeFormat: "relative" as const,
  inboxDensity: "comfortable" as const,
  showImages: true,
  markReadOnOpen: true,
};
