import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { APP_DOMAIN, APP_NAME, APP_SUPPORT_EMAIL } from "@/lib/config";

const PRODUCT = [
  { href: "/about", label: "About" },
  { href: "/login", label: "Sign in" },
  { href: "/contact", label: "Contact" },
] as const;

const LEGAL = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[var(--mk-line)] bg-[var(--mk-footer)] text-[var(--mk-ink)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="[&_span]:text-[var(--mk-ink)] [&_.bg-foreground]:bg-[var(--mk-ink)] [&_.bg-foreground]:text-[var(--mk-paper)]">
            <Logo />
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[color-mix(in_oklab,var(--mk-ink)_62%,transparent)]">
            Private receive-only email for verification codes and account security
            messages. One account, one mailbox at @{APP_DOMAIN}.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
            Product
          </p>
          <ul className="mt-4 space-y-2.5">
            {PRODUCT.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-[color-mix(in_oklab,var(--mk-ink)_78%,transparent)] transition-colors hover:text-[var(--mk-ink)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
            Legal
          </p>
          <ul className="mt-4 space-y-2.5">
            {LEGAL.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-[color-mix(in_oklab,var(--mk-ink)_78%,transparent)] transition-colors hover:text-[var(--mk-ink)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${APP_SUPPORT_EMAIL}`}
                className="text-sm text-[color-mix(in_oklab,var(--mk-ink)_78%,transparent)] transition-colors hover:text-[var(--mk-ink)]"
              >
                {APP_SUPPORT_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--mk-line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © 2026 {APP_NAME}. All rights reserved.
          </p>
          <p>{APP_DOMAIN}</p>
        </div>
      </div>
    </footer>
  );
}
