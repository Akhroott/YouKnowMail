"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDocumentVisible } from "@/hooks/use-document-visible";
import { api } from "@/lib/api/client";
import { INBOX_POLL_MS } from "@/lib/config";
import type { MessageListParams, MessageUpdate } from "@/lib/types";

export function useMessages(params: MessageListParams & { mailboxId?: string }) {
  const visible = useDocumentVisible();
  return useQuery({
    queryKey: ["messages", params],
    queryFn: () => api.messages.list(params),
    refetchInterval: visible ? INBOX_POLL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useMessage(id: string | null) {
  return useQuery({
    queryKey: ["message", id],
    queryFn: () => api.messages.get(id!),
    enabled: Boolean(id),
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: MessageUpdate }) =>
      api.messages.update(id, update),
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.setQueryData(["message", message.id], message);
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.messages.delete(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.removeQueries({ queryKey: ["message", id] });
    },
  });
}

export function useMailbox(mailboxId?: string | null) {
  return useQuery({
    queryKey: ["mailbox", mailboxId ?? "primary"],
    queryFn: () => api.mailbox.get(mailboxId),
  });
}

export function useMailboxes() {
  return useQuery({
    queryKey: ["mailboxes"],
    queryFn: () => api.mailbox.list(),
  });
}

export function useAccount() {
  return useQuery({
    queryKey: ["account"],
    queryFn: () => api.account.get(),
  });
}
