import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/marketing/faq";
import { InboxPreview } from "@/components/marketing/inbox-preview";
import { Button } from "@/components/ui/button";
import {
  APP_DESCRIPTION,
  APP_DOMAIN,
  APP_KEYWORDS,
  APP_NAME,
  APP_URL,
} from "@/lib/config";

export const metadata: Metadata = {
  title: `${APP_NAME} — Private receive-only email`,
  description: APP_DESCRIPTION,
  keywords: [...APP_KEYWORDS],
  alternates: { canonical: APP_URL },
  openGraph: {
    title: `${APP_NAME} · Your inbox. Your codes.`,
    description: APP_DESCRIPTION,
    url: APP_URL,
    siteName: APP_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} · Your inbox. Your codes.`,
    description: APP_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${APP_URL}/#organization`,
      name: APP_NAME,
      alternateName: ["YoyKnow Mail", "YoyKnow", "Yoyknow", "yoyknowmail"],
      url: APP_URL,
      email: `support@${APP_DOMAIN}`,
      logo: `${APP_URL}/icon`,
    },
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      url: APP_URL,
      name: APP_NAME,
      description: APP_DESCRIPTION,
      publisher: { "@id": `${APP_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: APP_NAME,
      alternateName: "YoyKnow Mail",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: APP_URL,
      description: APP_DESCRIPTION,
    },
  ],
};

const FEATURES = [
  {
    title: "One private mailbox",
    body: "Every login owns a single isolated inbox. No shared folders. No one else reading your codes.",
  },
  {
    title: "Receive-only by design",
    body: "Built for OTPs, password resets, and security alerts — never for composing or sending mail.",
  },
  {
    title: "Codes, front and center",
    body: "Open a message and grab the verification code fast. Templates render cleanly; scripts stay sandboxed.",
  },
  {
    title: "Familiar webmail feel",
    body: "A calm inbox experience you already understand — without the outbound surface area of Gmail or Outlook.",
  },
  {
    title: `Addresses on @${APP_DOMAIN}`,
    body: "Provisioned mailboxes on the YoyKnowMail domain, ready for sign-ups, 2FA, and account recovery.",
  },
  {
    title: "Staff-controlled access",
    body: "Accounts are created by admins or owners. Role boundaries keep owner-created mailboxes protected.",
  },
] as const;

const SECURITY = [
  {
    title: "Argon2id passwords",
    body: "Credentials are hashed with a modern memory-hard algorithm — never stored in plain text.",
  },
  {
    title: "Session + CSRF protection",
    body: "HttpOnly cookies and double-submit CSRF tokens on every mutating request.",
  },
  {
    title: "Sandboxed HTML reader",
    body: "Inbound HTML is sanitized and rendered in a restricted iframe so scripts cannot run.",
  },
  {
    title: "Optional TOTP 2FA",
    body: "Add an authenticator app for an extra factor on top of your password.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero — Sipher-like composition, B&W, brand-first */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 50% -20%, rgba(255,255,255,0.08), transparent 55%),
              radial-gradient(ellipse 50% 40% at 100% 30%, rgba(255,255,255,0.04), transparent 50%),
              linear-gradient(180deg, #0a0a0a 0%, #050505 55%, #000000 100%)
            `,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.22] mk-fade"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "linear-gradient(180deg, black 0%, transparent 72%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-end gap-10 px-5 pb-0 pt-14 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-8 lg:pt-20">
          <div className="pb-12 lg:pb-24">
            <p className="mk-rise inline-flex items-center rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-[11px] font-medium tracking-wide text-white/60">
              Protected receive-only mail
            </p>
            <h1 className="font-display mk-rise mk-rise-delay-1 mt-6 text-5xl font-semibold tracking-[-0.045em] text-white sm:text-6xl lg:text-[4.5rem] lg:leading-[0.98]">
              {APP_NAME}
            </h1>
            <p className="font-display mk-rise mk-rise-delay-2 mt-4 text-2xl font-medium tracking-tight text-white/90 sm:text-3xl">
              Your inbox. Your codes.
            </p>
            <p className="mk-rise mk-rise-delay-2 mt-4 max-w-md text-base leading-relaxed text-white/55 sm:text-lg">
              Private receive-only email for verification and security messages. One
              account. One mailbox. No outbound mail.
            </p>
            <div className="mk-rise mk-rise-delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white px-7 text-black hover:bg-white/90"
              >
                <Link href="/login">Sign in</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10"
              >
                <Link href="/#features">See features</Link>
              </Button>
            </div>
          </div>

          <div className="relative mk-fade lg:min-h-[540px]">
            <InboxPreview />
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 border-t border-white/10 bg-black">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Features
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Everything you need to stay verified
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/55">
              The clarity of modern webmail — scoped to inbound account mail only.
            </p>
          </div>

          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="border-t border-white/10 pt-6">
                <h3 className="font-display text-lg font-semibold tracking-tight text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="scroll-mt-24 border-t border-white/10 bg-[#0a0a0a]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Security
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Security you can trust
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/55">
              Built for account security workflows — with controls that keep sessions and
              message rendering locked down.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {SECURITY.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-black/40 px-6 py-7"
              >
                <h3 className="font-display text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              FAQ
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          <Faq />
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-16 sm:flex-row sm:items-center sm:px-8 sm:py-20">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Start protecting your verifications
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/55 sm:text-base">
              Sign in to your @{APP_DOMAIN} mailbox, or contact us to get access
              provisioned.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-white px-7 text-black hover:bg-white/90"
            >
              <Link href="/login">Sign in free</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              <Link href="/contact">Contact support</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
