import type { Metadata } from "next";
import { CustomerShell } from "@/components/mail/customer-shell";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: {
    default: "Inbox",
    template: `%s · ${APP_NAME}`,
  },
  description: `Your private ${APP_NAME} inbox.`,
  robots: { index: false, follow: false },
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CustomerShell>{children}</CustomerShell>;
}
