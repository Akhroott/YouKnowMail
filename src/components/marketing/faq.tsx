"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_DOMAIN, APP_NAME } from "@/lib/config";

const ITEMS = [
  {
    q: `What is ${APP_NAME}?`,
    a: `${APP_NAME} is a private, receive-only email service. Each account gets one mailbox on @${APP_DOMAIN} for verification codes, password resets, and security alerts — without the ability to send mail.`,
  },
  {
    q: "Can I send email?",
    a: "No. Outbound mail is intentionally disabled. The product is built only for reading inbound account and security messages.",
  },
  {
    q: "How do I get an account?",
    a: "Accounts are provisioned by staff. Contact support if you need access, then sign in with the credentials you receive.",
  },
  {
    q: "Is my mailbox private?",
    a: "Yes. One login maps to one isolated mailbox. Message bodies are not exposed on admin APIs, and HTML mail is sanitized in a sandboxed reader.",
  },
  {
    q: "Do you support two-factor authentication?",
    a: "Yes. TOTP 2FA is available on the authenticated app, along with HttpOnly session cookies and CSRF protection.",
  },
] as const;

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-white/10 border-y border-white/10">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span className="font-display text-base font-semibold tracking-tight text-white sm:text-lg">
                {item.q}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-white/50 transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-out",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                <p className="pb-5 pr-8 text-sm leading-relaxed text-white/55">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
