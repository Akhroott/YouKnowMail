import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: `%s · ${APP_NAME} Admin`,
  },
  description: `${APP_NAME} administrator console.`,
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
