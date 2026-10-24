/**
 * Conservative OTP extraction. Only returns a code when confidence is high.
 * Never logs extracted codes.
 */
const OTP_PATTERNS: RegExp[] = [
  /(?:verification|verify|security|authentication|login|one[- ]?time|otp|pass\s?code|access)\s*(?:code|number|pin)?\s*(?:is|:)\s*([0-9]{4,8})\b/i,
  /\b(?:code|pin)\s*(?:is|:)\s*([0-9]{4,8})\b/i,
  /\b([0-9]{6})\b(?:\s+is\s+your\s+(?:verification|security|login)\s+code)/i,
  /enter\s+(?:the\s+)?(?:code|otp)\s+([0-9]{4,8})\b/i,
];

export function extractVerificationCode(
  subject: string,
  bodyText: string,
  bodyHtml: string
): string | null {
  const plain = [subject, bodyText, stripTags(bodyHtml)].join("\n");

  for (const pattern of OTP_PATTERNS) {
    const match = plain.match(pattern);
    if (match?.[1] && isPlausibleOtp(match[1])) {
      return match[1];
    }
  }

  // High-confidence standalone 6-digit codes near verification keywords
  if (/\b(verification|verify|otp|one[- ]?time|security code)\b/i.test(plain)) {
    const sixDigit = plain.match(/(?:^|\s)([0-9]{6})(?:\s|$)/);
    if (sixDigit?.[1] && isPlausibleOtp(sixDigit[1])) {
      return sixDigit[1];
    }
  }

  return null;
}

function isPlausibleOtp(code: string): boolean {
  if (!/^[0-9]{4,8}$/.test(code)) return false;
  // Reject obvious non-OTPs like years or sequential placeholders
  if (/^(19|20)\d{2}$/.test(code)) return false;
  if (/^(\d)\1+$/.test(code)) return false;
  if (code === "123456" || code === "000000" || code === "1234") return false;
  return true;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
