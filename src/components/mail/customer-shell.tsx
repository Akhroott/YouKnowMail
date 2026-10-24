"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Suspense } from "react";
import { CustomerSidebar } from "@/components/mail/customer-sidebar";
import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Private inbox shell for all authenticated roles.
 * Staff (admin/owner) use the same inbox UI for their own mailbox only.
 */
export function CustomerShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-3 p-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Suspense fallback={<aside className="hidden w-64 border-r lg:block" />}>
        <CustomerSidebar />
      </Suspense>
      <main className="flex min-h-screen flex-1 flex-col overflow-hidden pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
