"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLogs } from "@/hooks/use-admin";
import type { AuditAction } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

const SENSITIVE_KEYS = /password|passwd|secret|token|code|body|otp|recovery/i;

function formatAction(action: AuditAction) {
  return action.replace(/_/g, " ");
}

function safeMetadata(metadata: Record<string, string>) {
  const entries = Object.entries(metadata).filter(([key]) => !SENSITIVE_KEYS.test(key));
  if (!entries.length) return null;
  return entries
    .map(([k, v]) => {
      if (SENSITIVE_KEYS.test(v)) return `${k}: [redacted]`;
      return `${k}: ${v}`;
    })
    .join(" · ");
}

export default function AdminActivityPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      page,
      pageSize,
    }),
    [search, page]
  );

  const { data, isLoading, isFetching } = useAuditLogs(params);
  const logs = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity logs</h1>
        <p className="text-sm text-muted-foreground">
          Immutable audit trail. Passwords, codes, and message bodies are never displayed.
        </p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Audit events</CardTitle>
            <CardDescription>{data?.total ?? 0} entries</CardDescription>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search action, actor, or target…"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-6 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td colSpan={6} className="px-6 py-3">
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  : logs.map((log) => {
                      const meta = safeMetadata(log.metadata);
                      return (
                        <tr key={log.id} className="border-b border-border/60 hover:bg-muted/30">
                          <td className="px-6 py-3 text-muted-foreground">
                            <span title={new Date(log.createdAt).toLocaleString()}>
                              {formatRelativeTime(log.createdAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3 capitalize">{formatAction(log.action)}</td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{log.actor}</p>
                              <p className="text-xs text-muted-foreground">{log.actorRole}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{log.target ?? "—"}</td>
                          <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                            {meta ?? "—"}
                            {log.ip ? (
                              <span className="mt-1 block font-mono text-[10px]">{log.ip}</span>
                            ) : null}
                          </td>
                          <td className="px-6 py-3">
                            <Badge variant={log.success ? "success" : "danger"}>
                              {log.success ? "Success" : "Failed"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {!isLoading && logs.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No audit entries found.</p>
          ) : null}

          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <p className="text-xs text-muted-foreground">
              Page {data?.page ?? page} of {totalPages}
              {isFetching ? " · Updating…" : null}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
