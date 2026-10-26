import { APP_DOMAIN, APP_NAME } from "@/lib/config";

const ROWS = [
  {
    from: "GitHub",
    subject: "Your authentication code",
    preview: "Use 482 910 to finish signing in…",
    time: "2m",
    code: true,
  },
  {
    from: "Stripe",
    subject: "Verify your email address",
    preview: "Confirm this address to secure payouts…",
    time: "18m",
    code: false,
  },
  {
    from: "Cloudflare",
    subject: "Security alert for your account",
    preview: "We noticed a new sign-in from…",
    time: "1h",
    code: false,
  },
  {
    from: "OpenAI",
    subject: "Your one-time passcode",
    preview: "Enter 739 204 to continue…",
    time: "3h",
    code: true,
  },
] as const;

export function InboxPreview() {
  return (
    <div
      className="mk-drift relative h-full min-h-[320px] w-full overflow-hidden rounded-none border-y border-[var(--mk-line)] bg-[var(--mk-paper)] shadow-[0_30px_80px_-40px_rgba(11,21,38,0.45)] sm:rounded-tl-[1.75rem] sm:border sm:border-r-0 sm:border-[var(--mk-line)]"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-[var(--mk-line)] bg-[var(--mk-mist)]/70 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#c5d0e0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#c5d0e0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#c5d0e0]" />
        </div>
        <div className="ml-2 flex-1 truncate rounded-md bg-[var(--mk-panel)] px-3 py-1.5 text-[11px] text-[color-mix(in_oklab,var(--mk-ink)_55%,transparent)]">
          inbox · you@{APP_DOMAIN}
        </div>
      </div>

      <div className="grid h-[calc(100%-2.75rem)] grid-cols-[4.5rem_1fr] sm:grid-cols-[5.5rem_1fr]">
        <aside className="border-r border-[var(--mk-line)] bg-[var(--mk-mist)]/40 px-2 py-3">
          <div className="mb-3 rounded-md bg-[var(--mk-ink)] px-2 py-2 text-center text-[10px] font-semibold text-[var(--mk-paper)]">
            Inbox
          </div>
          <div className="space-y-2 px-1 text-[10px] text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
            <p>Starred</p>
            <p>Archive</p>
            <p>Settings</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col bg-[var(--mk-panel)]">
          <div className="border-b border-[var(--mk-line)] px-4 py-3">
            <p className="font-display text-sm font-semibold tracking-tight text-[var(--mk-ink)]">
              {APP_NAME}
            </p>
            <p className="text-[11px] text-[color-mix(in_oklab,var(--mk-ink)_50%,transparent)]">
              Receive-only · private mailbox
            </p>
          </div>

          <ul className="divide-y divide-[var(--mk-line)] overflow-hidden">
            {ROWS.map((row) => (
              <li key={row.subject} className="flex gap-3 px-4 py-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mk-mist)] text-[10px] font-semibold text-[var(--mk-ink)]">
                  {row.from.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-[var(--mk-ink)]">
                      {row.from}
                    </p>
                    <span className="shrink-0 text-[10px] text-[color-mix(in_oklab,var(--mk-ink)_45%,transparent)]">
                      {row.time}
                    </span>
                  </div>
                  <p className="truncate text-xs text-[var(--mk-ink)]">{row.subject}</p>
                  <p className="truncate text-[11px] text-[color-mix(in_oklab,var(--mk-ink)_48%,transparent)]">
                    {row.preview}
                  </p>
                  {row.code ? (
                    <span className="mt-1.5 inline-flex rounded bg-[color-mix(in_oklab,var(--mk-teal)_18%,var(--mk-panel))] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--mk-teal-deep)]">
                      Code detected
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
