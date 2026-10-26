import type { Metadata } from "next";
import Link from "next/link";
import { InboxPreview } from "@/components/marketing/inbox-preview";
import { Button } from "@/components/ui/button";
import {
  APP_DESCRIPTION,
  APP_DOMAIN,
  APP_KEYWORDS,
  APP_NAME,
  APP_TAGLINE,
  APP_URL,
} from "@/lib/config";

export const metadata: Metadata = {
  title: `${APP_NAME} — Private receive-only email`,
  description: APP_DESCRIPTION,
  keywords: [...APP_KEYWORDS],
  alternates: { canonical: APP_URL },
  openGraph: {
    title: `${APP_NAME} · Secure receive-only email`,
    description: APP_DESCRIPTION,
    url: APP_URL,
    siteName: APP_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} · Secure receive-only email`,
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
      alternateName: ["YoyKnow Mail", "YoyKnow", "yoyknow mail"],
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
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

const FEATURES = [
  {
    title: "One private mailbox",
    body: "Every login owns a single isolated inbox. No shared folders, no team dumps of someone else’s mail.",
  },
  {
    title: "Receive-only by design",
    body: "Built for OTPs, password resets, and security alerts — not for composing or blasting outbound mail.",
  },
  {
    title: "Codes, front and center",
    body: "Open a message and grab the verification code fast. HTML templates render cleanly; scripts stay sandboxed.",
  },
  {
    title: `Addresses on @${APP_DOMAIN}`,
    body: "Provisioned mailboxes on the YoyKnowMail domain, ready for sign-ups, 2FA, and account recovery flows.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero — one composition: brand, headline, line, CTAs, dominant inbox plane */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 90% 70% at 10% -10%, rgba(197, 216, 240, 0.85), transparent 55%),
              radial-gradient(ellipse 60% 50% at 90% 20%, rgba(15, 118, 110, 0.12), transparent 50%),
              linear-gradient(180deg, var(--mk-mist) 0%, var(--mk-paper) 62%, #ffffff 100%)
            `,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] mk-fade"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(var(--mk-line) 1px, transparent 1px), linear-gradient(90deg, var(--mk-line) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(180deg, black 0%, transparent 78%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-end gap-10 px-5 pb-0 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-6 lg:pt-24">
          <div className="pb-10 lg:pb-24">
            <p className="mk-rise text-sm font-semibold tracking-[0.04em] text-[var(--mk-teal-deep)]">
              {APP_DOMAIN}
            </p>
            <h1 className="font-display mk-rise mk-rise-delay-1 mt-4 text-5xl font-semibold tracking-[-0.04em] text-[var(--mk-ink)] sm:text-6xl lg:text-[4.25rem] lg:leading-[1.02]">
              {APP_NAME}
            </h1>
            <p className="mk-rise mk-rise-delay-2 mt-5 max-w-md text-lg leading-relaxed text-[color-mix(in_oklab,var(--mk-ink)_68%,transparent)] sm:text-xl">
              {APP_TAGLINE}. A private inbox for verification codes — never for sending.
            </p>
            <div className="mk-rise mk-rise-delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-[var(--mk-ink)] text-[var(--mk-paper)] hover:bg-[var(--mk-ink-soft)]"
              >
                <Link href="/login">Sign in</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-[var(--mk-line)] bg-white/70 text-[var(--mk-ink)] hover:bg-white"
              >
                <Link href="/about">How it works</Link>
              </Button>
            </div>
          </div>

          <div className="relative mk-fade lg:min-h-[520px]">
            <InboxPreview />
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--mk-line)] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--mk-ink)] sm:text-3xl">
              Email that only goes one way
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[color-mix(in_oklab,var(--mk-ink)_62%,transparent)]">
              Like a familiar webmail experience — without the outbound risk.{" "}
              {APP_NAME} is for reading what services send you, securely.
            </p>
          </div>

          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="border-t border-[var(--mk-line)] pt-6">
                <h3 className="font-display text-lg font-semibold tracking-tight text-[var(--mk-ink)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color-mix(in_oklab,var(--mk-ink)_60%,transparent)]">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--mk-line)] bg-[var(--mk-mist)]/55">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 sm:flex-row sm:items-center sm:px-8 sm:py-16">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--mk-ink)]">
              Ready when your code arrives
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[color-mix(in_oklab,var(--mk-ink)_62%,transparent)]">
              Sign in to your private @{APP_DOMAIN} mailbox, or reach us if you need
              access provisioned.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="bg-[var(--mk-ink)] text-[var(--mk-paper)] hover:bg-[var(--mk-ink-soft)]"
            >
              <Link href="/login">Open inbox</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-[var(--mk-line)] bg-white/80 text-[var(--mk-ink)] hover:bg-white"
            >
              <Link href="/contact">Contact support</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
