import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to your ${APP_NAME} mailbox.`,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
