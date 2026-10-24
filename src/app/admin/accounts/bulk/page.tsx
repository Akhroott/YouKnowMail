"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBulkCreateAccounts } from "@/hooks/use-admin";
import { APP_DOMAIN } from "@/lib/config";
import type { BulkCreateAccountsResult } from "@/lib/types";
import {
  bulkCreateAccountsSchema,
  type BulkCreateAccountsFormValues,
} from "@/lib/validation";

function downloadCsv(result: BulkCreateAccountsResult) {
  const rows = [
    ["email", "password", "mailboxAddress", "userId", "mailboxId"],
    ...result.created.map((a) => [
      a.email,
      a.password,
      a.mailboxAddress,
      a.id,
      a.mailboxId,
    ]),
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yoyknowmail-accounts-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkCreateAccountsPage() {
  const bulkCreate = useBulkCreateAccounts();
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkCreateAccountsResult | null>(null);

  const form = useForm<BulkCreateAccountsFormValues>({
    resolver: zodResolver(bulkCreateAccountsSchema),
    defaultValues: {
      prefix: "",
      count: 10,
      startIndex: 1,
      padWidth: 3,
      useRandom: false,
      passwordMode: "generate",
      password: "",
      confirmPassword: "",
      displayNamePrefix: "",
    },
  });

  const passwordMode = useWatch({ control: form.control, name: "passwordMode" });
  const useRandom = useWatch({ control: form.control, name: "useRandom" });
  const prefix = useWatch({ control: form.control, name: "prefix" });
  const startIndex = useWatch({ control: form.control, name: "startIndex" });
  const padWidth = useWatch({ control: form.control, name: "padWidth" });

  const preview = useMemo(() => {
    const p = (prefix || "user").trim().toLowerCase() || "user";
    if (useRandom) return `${p}a1b2c3@${APP_DOMAIN}`;
    const n = String(startIndex ?? 1).padStart(padWidth ?? 3, "0");
    return `${p}${n}@${APP_DOMAIN}`;
  }, [prefix, useRandom, startIndex, padWidth]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setResult(null);
    try {
      const created = await bulkCreate.mutateAsync({
        prefix: values.prefix.trim().toLowerCase(),
        count: values.count,
        startIndex: values.startIndex,
        padWidth: values.padWidth,
        useRandom: values.useRandom,
        passwordMode: values.passwordMode,
        password: values.passwordMode === "shared" ? values.password : undefined,
        displayNamePrefix: values.displayNamePrefix?.trim() || undefined,
      });
      setResult(created);
      toast.success(
        `Created ${created.createdCount} account${created.createdCount === 1 ? "" : "s"}` +
          (created.skippedCount ? ` · ${created.skippedCount} skipped` : "")
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bulk create failed";
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk create accounts</h1>
        <p className="text-sm text-muted-foreground">
          Provisions many customer logins, each with its own private mailbox at @{APP_DOMAIN}.
        </p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Batch settings</CardTitle>
          <CardDescription>
            Example address: <span className="font-mono text-foreground">{preview}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prefix">Username prefix</Label>
                <Input
                  id="prefix"
                  spellCheck={false}
                  placeholder="valo"
                  {...form.register("prefix", {
                    setValueAs: (v) => String(v ?? "").trim().toLowerCase(),
                  })}
                />
                {form.formState.errors.prefix ? (
                  <p className="text-xs text-destructive">{form.formState.errors.prefix.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="count">Count (max 100)</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={100}
                  {...form.register("count", { valueAsNumber: true })}
                />
                {form.formState.errors.count ? (
                  <p className="text-xs text-destructive">{form.formState.errors.count.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="startIndex">Start index</Label>
                <Input
                  id="startIndex"
                  type="number"
                  min={0}
                  disabled={useRandom}
                  {...form.register("startIndex", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="padWidth">Number padding</Label>
                <Input
                  id="padWidth"
                  type="number"
                  min={1}
                  max={8}
                  disabled={useRandom}
                  {...form.register("padWidth", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Password mode</Label>
                <Select
                  value={passwordMode}
                  onValueChange={(v) =>
                    form.setValue("passwordMode", v as "shared" | "generate", {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generate">Generate unique passwords</SelectItem>
                    <SelectItem value="shared">Same password for all</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="useRandom"
                checked={useRandom}
                onCheckedChange={(checked) =>
                  form.setValue("useRandom", checked === true, { shouldValidate: true })
                }
              />
              <Label htmlFor="useRandom" className="font-normal text-muted-foreground">
                Use random suffixes instead of sequential numbers
              </Label>
            </div>

            {passwordMode === "shared" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Shared password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    {...form.register("password")}
                  />
                  {form.formState.errors.password ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    {...form.register("confirmPassword")}
                  />
                  {form.formState.errors.confirmPassword ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Each account gets a unique password. Download the CSV after creation — passwords are
                shown only once.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="displayNamePrefix">Display name prefix (optional)</Label>
              <Input
                id="displayNamePrefix"
                placeholder="Batch"
                {...form.register("displayNamePrefix")}
              />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={bulkCreate.isPending}>
                {bulkCreate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create accounts
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/accounts">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Results</CardTitle>
              <CardDescription>
                {result.createdCount} created · {result.skippedCount} skipped
              </CardDescription>
            </div>
            {result.createdCount > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => downloadCsv(result)}>
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {result.created.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.created.map((row) => (
                      <tr key={row.id} className="border-t border-border/60">
                        <td className="px-3 py-2 font-mono">{row.email}</td>
                        <td className="px-3 py-2 font-mono">{row.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {result.skipped.length > 0 ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Skipped</p>
                {result.skipped.map((s) => (
                  <p key={`${s.username}-${s.reason}`} className="font-mono">
                    {s.username}: {s.reason}
                  </p>
                ))}
              </div>
            ) : null}
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/accounts">Back to accounts</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
