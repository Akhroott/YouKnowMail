import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
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
  title: `${APP_NAME} — YoyKnow Mail | Secure receive-only email`,
  description: APP_DESCRIPTION,
  keywords: [...APP_KEYWORDS],
  alternates: { canonical: APP_URL },
  openGraph: {
    title: `${APP_NAME} · YoyKnow Mail`,
    description: APP_DESCRIPTION,
    url: APP_URL,
    siteName: APP_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} · YoyKnow Mail`,
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

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,0,0,0.04),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.05),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.02))]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Logo />
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-16 pt-10">
        <p className="text-sm font-medium text-muted-foreground">{APP_DOMAIN}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {APP_NAME}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">{APP_TAGLINE}</p>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          YoyKnow Mail — also searched as YoyKnow or yoyknowmail — gives each account one private
          receive-only mailbox for verification codes and security messages. No outbound mail. No
          shared inboxes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/login">Sign in to {APP_NAME}</Link>
          </Button>
        </div>

        <section className="mt-16 grid gap-8 border-t border-border pt-10 sm:grid-cols-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Private mailbox</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              One login, one mailbox. Your messages stay isolated.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Receive-only</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Built for OTPs and account mail — not for sending spam.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">@{APP_DOMAIN}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Addresses on the YoyKnowMail domain, ready for sign-ups and verifications.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 px-6 pb-8 text-center text-xs text-muted-foreground">
        {APP_NAME} · YoyKnow Mail · {APP_DOMAIN}
      </footer>
    </div>
  );
}
