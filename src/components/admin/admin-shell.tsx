"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { useAuth } from "@/components/providers/auth-provider";
import { isStaffRole } from "@/lib/auth/roles";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const allowed = isAuthenticated && isStaffRole(user?.role);

  useEffect(() => {
    if (isLoading) return;
    if (!allowed) {
      router.replace(user ? "/inbox" : "/login");
    }
  }, [isLoading, allowed, user, router]);

  if (isLoading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 pb-10 pt-14 lg:px-8 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}
