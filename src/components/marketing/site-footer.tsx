import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { APP_DOMAIN, APP_NAME, APP_SUPPORT_EMAIL } from "@/lib/config";

const PRODUCT = [
  { href: "/#features", label: "Features" },
  { href: "/#security", label: "Security" },
  { href: "/about", label: "About" },
  { href: "/login", label: "Sign in" },
] as const;

const COMPANY = [
  { href: "/contact", label: "Contact" },
  { href: `mailto:${APP_SUPPORT_EMAIL}`, label: "Support" },
] as const;

const LEGAL = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-black text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <div className="[&_span]:text-white [&_.bg-foreground]:bg-white [&_.bg-foreground]:text-black">
            <Logo />
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
            Private receive-only email for the verification-conscious. One account, one
            mailbox at @{APP_DOMAIN}.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
            Product
          </p>
          <ul className="mt-4 space-y-2.5">
            {PRODUCT.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-white/60 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
            Company
          </p>
          <ul className="mt-4 space-y-2.5">
            {COMPANY.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-white/60 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
            Legal
          </p>
          <ul className="mt-4 space-y-2.5">
            {LEGAL.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-white/60 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © 2026 {APP_NAME}. All rights reserved.
          </p>
          <p>{APP_DOMAIN}</p>
        </div>
      </div>
    </footer>
  );
}
