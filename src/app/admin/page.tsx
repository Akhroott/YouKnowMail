"use client";

import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  HardDrive,
  Inbox,
  Mail,
  PauseCircle,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStats } from "@/hooks/use-admin";
import { APP_NAME } from "@/lib/config";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import type { AuditAction } from "@/lib/types";

function actionLabel(action: AuditAction): string {
  return action.replace(/_/g, " ");
}

export default function AdminOverviewPage() {
  const { data: stats, isLoading, isError, error } = useAdminStats();

  const storagePct =
    stats && stats.storageLimit > 0
      ? Math.min(100, Math.round((stats.storageUsed / stats.storageLimit) * 100))
      : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            {APP_NAME} platform health, growth, and recent administrative activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/inbox">My Inbox</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/accounts/create">Create account</Link>
          </Button>
        </div>
      </motion.div>

      {isError ? (
        <Card className="border-destructive/40">
          <CardContent className="space-y-2 py-8 text-center text-sm">
            <p className="font-medium text-destructive">Unable to load dashboard statistics</p>
            <p className="text-muted-foreground">
              {(error as Error)?.message || "The live API request failed. No demo data is shown."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total mailboxes",
            value: stats?.totalMailboxes,
            icon: Inbox,
            sub: stats ? `${stats.mailboxesCreatedToday} created today` : undefined,
          },
          {
            label: "Active",
            value: stats?.activeMailboxes,
            icon: TrendingUp,
            sub: stats ? `${stats.suspendedMailboxes} suspended` : undefined,
          },
          {
            label: "Messages today",
            value: stats?.messagesToday,
            icon: Mail,
            sub: "Inbound receive-only",
          },
          {
            label: "Storage used",
            value: stats ? formatBytes(stats.storageUsed) : undefined,
            icon: HardDrive,
            sub: stats ? `of ${formatBytes(stats.storageLimit)}` : undefined,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border-border/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <p className="text-2xl font-semibold tracking-tight">{card.value ?? "—"}</p>
                    {card.sub ? (
                      <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/80 shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Storage</CardTitle>
            <CardDescription>Aggregate mailbox storage consumption</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="font-medium">{storagePct}%</span>
                </div>
                <Progress value={storagePct} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {stats ? formatBytes(stats.storageUsed) : "—"} used across all mailboxes
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Mailbox growth</CardTitle>
            <CardDescription>Total mailboxes over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[240px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.mailboxGrowth ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    }
                  />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                    }}
                    labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--foreground)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Inbound volume</CardTitle>
          <CardDescription>Messages received per day (metadata only)</CardDescription>
        </CardHeader>
        <CardContent className="h-[220px]">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.inboundVolume ?? []}>
                <defs>
                  <linearGradient id="inboundFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  }
                />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--foreground)"
                  fill="url(#inboundFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Audit events — no message content</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/activity">
              View all
              <ArrowDownToLine className="ml-1 h-3.5 w-3.5 rotate-180" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(stats?.recentActivity ?? []).map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="mt-0.5 rounded-md bg-muted p-1.5">
                    {entry.success ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <PauseCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{actionLabel(entry.action)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.actor}
                      {entry.target ? ` · ${entry.target}` : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                    <Badge variant={entry.success ? "secondary" : "danger"} className="text-[10px]">
                      {entry.actorRole}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
