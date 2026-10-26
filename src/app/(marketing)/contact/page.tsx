import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { APP_DOMAIN, APP_NAME, APP_SUPPORT_EMAIL, APP_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${APP_NAME} support at ${APP_SUPPORT_EMAIL} for account access, mailbox help, or privacy requests.`,
  alternates: { canonical: `${APP_URL}/contact` },
};

export default function ContactPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
          Contact
        </p>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-[var(--mk-ink)] sm:text-4xl">
          We’re here to help
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-[color-mix(in_oklab,var(--mk-ink)_65%,transparent)]">
          Account access, mailbox issues, or privacy requests — reach the {APP_NAME} team
          directly.
        </p>

        <div className="mt-10 space-y-6 border-t border-[var(--mk-line)] pt-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
              Support email
            </p>
            <a
              href={`mailto:${APP_SUPPORT_EMAIL}`}
              className="mt-2 inline-block text-lg font-medium text-white underline-offset-4 hover:underline"
            >
              {APP_SUPPORT_EMAIL}
            </a>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
              Product
            </p>
            <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--mk-ink)_65%,transparent)]">
              {APP_NAME} · {APP_DOMAIN}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
              Typical response
            </p>
            <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--mk-ink)_65%,transparent)]">
              We aim to reply within 1–2 business days.
            </p>
          </div>
        </div>
      </div>

      <ContactForm />
    </div>
  );
}
