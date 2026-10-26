import { APP_DOMAIN, APP_NAME } from "@/lib/config";

const NAV = [
  { label: "Inbox", count: "4", active: true },
  { label: "Starred", count: "", active: false },
  { label: "Archive", count: "", active: false },
  { label: "Settings", count: "", active: false },
] as const;

const ROWS = [
  {
    from: "Google",
    initials: "GO",
    subject: "Your account security alert",
    preview: "We noticed a new sign-in to your account…",
    time: "2:45 PM",
    active: true,
    code: false,
  },
  {
    from: "GitHub",
    initials: "GI",
    subject: "Your authentication code",
    preview: "Use 482 910 to finish signing in…",
    time: "11:20 AM",
    active: false,
    code: true,
  },
  {
    from: "Stripe",
    initials: "ST",
    subject: "Verify your email address",
    preview: "Confirm this address to secure payouts…",
    time: "Yesterday",
    active: false,
    code: false,
  },
  {
    from: "Cloudflare",
    initials: "CF",
    subject: "Security alert for your account",
    preview: "We noticed a new sign-in from…",
    time: "Mon",
    active: false,
    code: false,
  },
  {
    from: "OpenAI",
    initials: "OA",
    subject: "Your one-time passcode",
    preview: "Enter 739 204 to continue…",
    time: "Sun",
    active: false,
    code: true,
  },
] as const;

export function InboxPreview() {
  return (
    <div
      className="mk-drift relative flex h-full min-h-[420px] w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/12 bg-[#0a0a0a] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)] sm:min-h-[520px] sm:rounded-tl-[1.5rem] sm:rounded-tr-none sm:border-r-0"
      aria-hidden
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold tracking-tight text-white">
            {APP_NAME}
          </p>
          <p className="hidden truncate text-[10px] text-white/40 sm:block">
            you@{APP_DOMAIN}
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[5.25rem_1fr] sm:grid-cols-[7.5rem_1fr]">
        <aside className="border-r border-white/10 bg-black/40 px-2 py-3 sm:px-3">
          <p className="mb-3 px-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Mail
          </p>
          <div className="space-y-1">
            {NAV.map((item) => (
              <div
                key={item.label}
                className={
                  item.active
                    ? "flex items-center justify-between rounded-md bg-white px-2 py-1.5 text-[10px] font-semibold text-black"
                    : "flex items-center justify-between rounded-md px-2 py-1.5 text-[10px] text-white/45"
                }
              >
                <span>{item.label}</span>
                {item.count ? <span>{item.count}</span> : null}
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col bg-[#0a0a0a]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Inbox</p>
              <p className="text-[10px] text-white/40">Receive-only · private</p>
            </div>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/55">
              1–5 of 5
            </span>
          </div>

          <ul className="min-h-0 flex-1 overflow-hidden">
            {ROWS.map((row) => (
              <li
                key={row.subject}
                className={
                  row.active
                    ? "flex gap-3 border-b border-white/10 bg-white/[0.06] px-4 py-3"
                    : "flex gap-3 border-b border-white/10 px-4 py-3"
                }
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[9px] font-semibold tracking-wide text-white/80">
                  {row.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-white">{row.from}</p>
                    <span className="shrink-0 text-[10px] text-white/35">{row.time}</span>
                  </div>
                  <p className="truncate text-xs text-white/90">{row.subject}</p>
                  <p className="truncate text-[11px] text-white/40">{row.preview}</p>
                  {row.code ? (
                    <span className="mt-1.5 inline-flex rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/75">
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
