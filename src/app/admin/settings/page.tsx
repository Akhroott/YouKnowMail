"use client";

import { Globe, Lock, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { API_BASE_URL, APP_NAME, DOMAINS } from "@/lib/config";

export default function AdminSettingsPage() {
  const apiBase = API_BASE_URL || "(same origin)";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Platform configuration visible to administrators.
        </p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            Domains
          </CardTitle>
          <CardDescription>
            Receive-only domains provisioned for {APP_NAME}. Managed at infrastructure level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {DOMAINS.map((domain) => (
              <li
                key={domain}
                className="flex items-center justify-between rounded-lg border border-border/80 px-3 py-2 text-sm"
              >
                <span className="font-mono">{domain}</span>
                <Badge variant="secondary">Read-only</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Security & privacy
          </CardTitle>
          <CardDescription>Operational boundaries for admin and owner staff.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Staff access only their own private inbox. The admin console must not expose customer
            message bodies, verification codes, or cross-account mailbox contents. It shows
            metadata only: accounts, quotas, audit events, and status.
          </p>
          <Separator />
          <ul className="list-inside list-disc space-y-2">
            <li>All privileged actions are written to the activity log.</li>
            <li>Create accounts via the unified flow — never log or display passwords.</li>
            <li>Use suspend/reactivate instead of deleting accounts when investigating abuse.</li>
            <li>Owner role and last-active-owner protection are enforced by the API.</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Environment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">API mode</span>
            <Badge variant="success">Live API</Badge>
          </div>
          <div className="flex justify-between gap-4">
            <span className="shrink-0 text-muted-foreground">API base</span>
            <span className="truncate font-mono text-xs">{apiBase}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Application</span>
            <span className="font-medium">{APP_NAME}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
