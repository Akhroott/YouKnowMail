import type { ReactNode } from "react";

export function LegalPage({
  title,
  description,
  updated,
  children,
}: {
  title: string;
  description: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
        Legal
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-[var(--mk-ink)] sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[color-mix(in_oklab,var(--mk-ink)_62%,transparent)]">
        {description}
      </p>
      <p className="mt-4 text-sm text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
        Last updated: {updated}
      </p>
      <div className="marketing-prose mt-10 border-t border-[var(--mk-line)] pt-8">{children}</div>
    </article>
  );
}
