"use client";

import {
  Archive,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Star,
  Trash2,
  MailOpen,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useMailbox, useMailboxes } from "@/hooks/use-messages";
import { isStaffRole } from "@/lib/auth/roles";
import { cn, getInitials } from "@/lib/utils";

export function CustomerSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed left-3 top-3 z-40 lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar lg:flex lg:flex-col">
        <SidebarInner onNavigate={() => undefined} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="Close overlay"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-border bg-sidebar shadow-xl">
            <SidebarInner onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}

function SidebarInner({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout } = useAuth();
  const mailboxId = searchParams.get("mailboxId");
  const { data: mailboxes } = useMailboxes();
  const { data: mailbox } = useMailbox(mailboxId);
  const folder = searchParams.get("folder");

  const withMailbox = (href: string) => {
    if (!mailboxId) return href;
    const [path, qs] = href.split("?");
    const params = new URLSearchParams(qs ?? "");
    params.set("mailboxId", mailboxId);
    return `${path}?${params.toString()}`;
  };

  const staff = isStaffRole(user?.role);

  const navItems = [
    { href: withMailbox("/inbox"), label: "Inbox", icon: Inbox, folder: null as string | null },
    {
      href: withMailbox("/inbox?folder=unread"),
      label: "Unread",
      icon: MailOpen,
      folder: "unread",
    },
    {
      href: withMailbox("/inbox?folder=starred"),
      label: "Starred",
      icon: Star,
      folder: "starred",
    },
    {
      href: withMailbox("/inbox?folder=archive"),
      label: "Archive",
      icon: Archive,
      folder: "archive",
    },
    {
      href: withMailbox("/inbox?folder=trash"),
      label: "Trash",
      icon: Trash2,
      folder: "trash",
    },
    { href: "/settings", label: "Settings", icon: Settings, folder: undefined as undefined },
    ...(staff
      ? [
          {
            href: "/admin",
            label: "Admin console",
            icon: LayoutDashboard,
            folder: undefined as undefined,
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <Logo />
        {staff ? (
          <p className="mt-1 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Your private inbox
          </p>
        ) : null}
      </div>

      {(mailboxes?.data?.length ?? 0) > 1 ? (
        <div className="px-3 pb-3">
          <Select
            value={mailboxId ?? mailbox?.id ?? mailboxes?.data?.[0]?.id}
            onValueChange={(id) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("mailboxId", id);
              router.push(`/inbox?${params.toString()}`);
              onNavigate();
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Mailbox" />
            </SelectTrigger>
            <SelectContent>
              {mailboxes?.data.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isSettings = item.href === "/settings";
          const isAdmin = item.href === "/admin";
          const active = isAdmin
            ? false
            : isSettings
              ? pathname.startsWith("/settings")
              : pathname.startsWith("/inbox") &&
                (item.folder ? folder === item.folder : !folder);

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{getInitials(user?.displayName ?? "U")}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {mailbox?.address ?? user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
