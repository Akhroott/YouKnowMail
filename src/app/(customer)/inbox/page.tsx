"use client";

import {
  Archive,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageList } from "@/components/mail/message-list";
import { MessageReader } from "@/components/mail/message-reader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useDeleteMessage,
  useMessage,
  useMessages,
  useUpdateMessage,
  useAccount,
} from "@/hooks/use-messages";
import type { MessageFolder } from "@/lib/types";
import { cn } from "@/lib/utils";

function InboxContent() {
  const searchParams = useSearchParams();
  const folderParam = searchParams.get("folder") as MessageFolder | "unread" | null;
  const folder = folderParam ?? "inbox";
  const mailboxId = searchParams.get("mailboxId") ?? undefined;
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileReading, setMobileReading] = useState(false);

  const { data: account } = useAccount();
  const density = account?.preferences.inboxDensity ?? "comfortable";

  const listQuery = useMessages({
    folder,
    search: deferredSearch || undefined,
    page,
    pageSize: 20,
    mailboxId,
  });
  const messageQuery = useMessage(activeId);
  const updateMessage = useUpdateMessage();
  const deleteMessage = useDeleteMessage();

  const title = useMemo(() => {
    switch (folder) {
      case "unread":
        return "Unread";
      case "starred":
        return "Starred";
      case "archive":
        return "Archive";
      case "trash":
        return "Trash";
      default:
        return "Inbox";
    }
  }, [folder]);

  const openMessage = async (id: string) => {
    setActiveId(id);
    setMobileReading(true);
    const message = listQuery.data?.data.find((m) => m.id === id);
    if (message && !message.isRead && account?.preferences.markReadOnOpen !== false) {
      updateMessage.mutate({ id, update: { isRead: true } });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkArchive = async () => {
    await Promise.all(
      [...selectedIds].map((id) =>
        updateMessage.mutateAsync({ id, update: { folder: "archive" } })
      )
    );
    setSelectedIds(new Set());
    toast.success("Archived selected messages");
  };

  const bulkDelete = async () => {
    if (!window.confirm(`Move ${selectedIds.size} message(s) to trash?`)) return;
    try {
      await Promise.all([...selectedIds].map((id) => deleteMessage.mutateAsync(id)));
      setSelectedIds(new Set());
      if (activeId && selectedIds.has(activeId)) {
        setActiveId(null);
        setMobileReading(false);
      }
      toast.success("Moved to trash");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete messages");
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col lg:h-screen">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 pl-14 lg:pl-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="text-xs text-muted-foreground">
            {listQuery.data?.total ?? 0} messages
          </p>
        </div>
        <div className="ml-auto flex flex-1 items-center gap-2 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search messages"
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => listQuery.refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", listQuery.isFetching && "animate-spin")} />
          </Button>
        </div>
      </header>

      {listQuery.isError ? (
        <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {(listQuery.error as Error)?.message || "Could not load messages."}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => listQuery.refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {selectedIds.size > 0 ? (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
          <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={bulkArchive}>
            <Archive className="h-4 w-4" />
            Archive
          </Button>
          <Button size="sm" variant="outline" onClick={bulkDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <div
          className={cn(
            "flex min-h-0 flex-col border-r border-border",
            mobileReading ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MessageList
              messages={listQuery.data?.data ?? []}
              selectedIds={selectedIds}
              activeId={activeId}
              density={density}
              loading={listQuery.isLoading}
              onSelect={openMessage}
              onToggleSelect={toggleSelect}
              onToggleStar={(id, starred) =>
                updateMessage.mutate({ id, update: { isStarred: starred } })
              }
            />
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {listQuery.data?.page ?? 1} of {listQuery.data?.totalPages ?? 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={(listQuery.data?.page ?? 1) >= (listQuery.data?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className={cn("min-h-0", mobileReading ? "flex" : "hidden lg:flex")}>
          <div className="w-full">
            <MessageReader
              message={messageQuery.data}
              loading={Boolean(activeId) && messageQuery.isLoading}
              allowImages={account?.preferences.showImages !== false}
              onBack={() => {
                setMobileReading(false);
                setActiveId(null);
              }}
              onToggleStar={() => {
                if (!messageQuery.data) return;
                updateMessage.mutate({
                  id: messageQuery.data.id,
                  update: { isStarred: !messageQuery.data.isStarred },
                });
              }}
              onMarkUnread={() => {
                if (!messageQuery.data) return;
                updateMessage.mutate({
                  id: messageQuery.data.id,
                  update: { isRead: false },
                });
                toast.success("Marked as unread");
              }}
              onArchive={() => {
                if (!messageQuery.data) return;
                updateMessage.mutate({
                  id: messageQuery.data.id,
                  update: { folder: "archive" },
                });
                setActiveId(null);
                setMobileReading(false);
                toast.success("Archived");
              }}
              onDelete={async () => {
                if (!messageQuery.data) return;
                if (!window.confirm("Move this message to trash?")) return;
                try {
                  await deleteMessage.mutateAsync(messageQuery.data.id);
                  setActiveId(null);
                  setMobileReading(false);
                  toast.success("Moved to trash");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not delete");
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading inbox…</div>}>
      <InboxContent />
    </Suspense>
  );
}
