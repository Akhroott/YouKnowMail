"use client";

import {
  Archive,
  ArrowLeft,
  ImageIcon,
  ImageOff,
  Mail,
  MailOpen,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SandboxedEmailHtml } from "@/components/mail/sandboxed-email-html";
import { VerificationCodePanel } from "@/components/mail/verification-code-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Message } from "@/lib/types";
import { cn, formatRelativeTime } from "@/lib/utils";

interface MessageReaderProps {
  message?: Message;
  loading?: boolean;
  /** From account preferences — remote images in HTML bodies */
  allowImages?: boolean;
  onBack: () => void;
  onToggleStar: () => void;
  onMarkUnread: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function MessageReader({
  message,
  loading,
  allowImages = true,
  onBack,
  onToggleStar,
  onMarkUnread,
  onArchive,
  onDelete,
}: MessageReaderProps) {
  const [showOriginal, setShowOriginal] = useState(true);
  const [imagesOn, setImagesOn] = useState(allowImages);

  useEffect(() => {
    setImagesOn(allowImages);
  }, [allowImages, message?.id]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Mail className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Select a message to read</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="lg:hidden">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button variant="ghost" size="sm" onClick={onMarkUnread}>
          <MailOpen className="h-4 w-4" />
          Mark unread
        </Button>
        <Button variant="ghost" size="sm" onClick={onToggleStar}>
          <Star className={cn("h-4 w-4", message.isStarred && "fill-amber-400 text-amber-500")} />
          {message.isStarred ? "Unstar" : "Star"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onArchive}>
          <Archive className="h-4 w-4" />
          Archive
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
        {message.bodyHtml?.trim() ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setImagesOn((v) => !v)}
            title={imagesOn ? "Hide remote images" : "Show remote images"}
          >
            {imagesOn ? <ImageOff className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            {imagesOn ? "Hide images" : "Show images"}
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {message.detectedCode && showOriginal === false ? (
            <VerificationCodePanel
              code={message.detectedCode}
              onViewOriginal={() => setShowOriginal(true)}
            />
          ) : null}

          {message.detectedCode && showOriginal ? (
            <VerificationCodePanel code={message.detectedCode} />
          ) : null}

          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {message.subject}
            </h1>
            <div className="mt-4 flex flex-col gap-1 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{message.from.name}</span>
                <span className="text-muted-foreground">&lt;{message.from.address}&gt;</span>
              </div>
              <p className="text-muted-foreground">
                To: {message.to.address}
              </p>
              <p className="text-muted-foreground">
                {new Date(message.receivedAt).toLocaleString()} ·{" "}
                {formatRelativeTime(message.receivedAt)}
              </p>
            </div>
          </div>

          <Separator />

          {message.bodyHtml?.trim() ? (
            <SandboxedEmailHtml html={message.bodyHtml} allowImages={imagesOn} />
          ) : (
            <pre className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
              {message.bodyText || "(No message body)"}
            </pre>
          )}

          <p className="text-xs text-muted-foreground">
            {imagesOn
              ? "Remote images are shown. Scripts stay blocked and HTML remains sandboxed."
              : "Remote images are hidden. Scripts stay blocked and HTML remains sandboxed."}{" "}
            Change the default under Settings → Preferences.
          </p>
        </div>
      </div>
    </div>
  );
}
