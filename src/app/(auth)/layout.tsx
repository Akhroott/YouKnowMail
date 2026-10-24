import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { APP_DOMAIN, APP_NAME, APP_TAGLINE } from "@/lib/config";

export const metadata: Metadata = {
  title: `Sign in to ${APP_NAME}`,
  description: `Sign in to YoyKnow Mail (${APP_NAME}) — ${APP_TAGLINE}. Access your private receive-only mailbox at yoyknowmail.com.`,
  robots: { index: true, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,0,0,0.03),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.04),_transparent_55%)]" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Logo />
        <p className="hidden text-sm text-muted-foreground sm:block">{APP_TAGLINE}</p>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10">
        {children}
      </main>
      <footer className="relative z-10 px-6 pb-6 text-center text-xs text-muted-foreground">
        {APP_NAME} · {APP_DOMAIN}
      </footer>
    </div>
  );
}
