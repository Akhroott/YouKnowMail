"use client";

import { Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_NAME } from "@/lib/config";
import type { Message } from "@/lib/types";
import { cn, formatRelativeTime } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
  selectedIds: Set<string>;
  activeId?: string | null;
  density?: "comfortable" | "compact";
  loading?: boolean;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleStar: (id: string, starred: boolean) => void;
}

export function MessageList({
  messages,
  selectedIds,
  activeId,
  density = "comfortable",
  loading,
  onSelect,
  onToggleSelect,
  onToggleStar,
}: MessageListProps) {
  if (loading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted">
          <span className="text-xl">∅</span>
        </div>
        <h3 className="text-lg font-semibold">Inbox zero</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {APP_NAME} will show new verification emails and account security messages here when they
          arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {messages.map((message) => {
        const selected = selectedIds.has(message.id);
        const active = activeId === message.id;
        return (
          <div
            key={message.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(message.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(message.id);
              }
            }}
            className={cn(
              "group flex w-full cursor-pointer items-start gap-3 px-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              density === "compact" ? "py-2" : "py-3",
              !message.isRead && "bg-muted/30",
              active && "bg-muted",
              selected && "bg-muted/80"
            )}
          >
            <div
              className="pt-1"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect(message.id)}
                aria-label={`Select ${message.subject}`}
              />
            </div>
            <button
              type="button"
              className="pt-0.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(message.id, !message.isStarred);
              }}
              aria-label={message.isStarred ? "Unstar" : "Star"}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  message.isStarred && "fill-amber-400 text-amber-500"
                )}
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p
                  className={cn(
                    "truncate text-sm",
                    !message.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                  )}
                >
                  {message.from.name}
                </p>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(message.receivedAt)}
                </time>
              </div>
              <p
                className={cn(
                  "truncate text-sm",
                  !message.isRead ? "font-medium" : "text-foreground/80"
                )}
              >
                {message.subject}
                {message.detectedCode ? (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Code
                  </span>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">{message.preview}</p>
            </div>
            {!message.isRead ? (
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-foreground" aria-label="Unread" />
            ) : (
              <span className="mt-2 h-2 w-2 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
