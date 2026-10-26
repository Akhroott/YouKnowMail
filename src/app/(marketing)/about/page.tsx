import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_DOMAIN, APP_NAME, APP_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "About",
  description: `Learn how ${APP_NAME} provides private, receive-only email for verification codes and security messages.`,
  alternates: { canonical: `${APP_URL}/about` },
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
        About
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-[var(--mk-ink)] sm:text-4xl">
        A focused inbox for the messages that matter
      </h1>
      <p className="mt-4 text-base leading-relaxed text-[color-mix(in_oklab,var(--mk-ink)_65%,transparent)]">
        {APP_NAME} (also known as YoyKnow Mail) is a receive-only email service. Accounts
        get one private mailbox on @{APP_DOMAIN} for verification codes, password resets,
        and security alerts — without the ability to send mail.
      </p>

      <div className="marketing-prose mt-10 border-t border-[var(--mk-line)] pt-8">
        <h2>Why receive-only?</h2>
        <p>
          Most “temporary inbox” tools are noisy, shared, or built for throwaway sign-ups.
          Full webmail suites are powerful — and easy to misuse for outbound spam.{" "}
          {APP_NAME} sits in between: a calm, authenticated inbox for inbound account mail
          only.
        </p>

        <h2>How it works</h2>
        <ul>
          <li>Staff provision a login and matching mailbox for you.</li>
          <li>You sign in on {APP_DOMAIN} with your credentials (and 2FA when enabled).</li>
          <li>Inbound mail is delivered to your private mailbox and appears in the inbox.</li>
          <li>You read messages, copy codes, archive or delete — you never compose or send.</li>
        </ul>

        <h2>Who it is for</h2>
        <p>
          Individuals and teams that need reliable private addresses for account security
          workflows, without running a full outbound mail stack.
        </p>

        <h2>Security posture</h2>
        <p>
          Sessions use HttpOnly cookies with CSRF protection. Passwords are hashed with
          Argon2id. HTML email is sanitized and shown in a sandboxed reader. Message bodies
          are never exposed on admin APIs.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Button
          asChild
          className="bg-[var(--mk-ink)] text-[var(--mk-paper)] hover:bg-[var(--mk-ink-soft)]"
        >
          <Link href="/login">Sign in</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="border-[var(--mk-line)] bg-[var(--mk-mist)] text-[var(--mk-ink)] hover:bg-[var(--mk-panel)]"
        >
          <Link href="/privacy">Privacy Policy</Link>
        </Button>
      </div>
    </div>
  );
}
