"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateAccount } from "@/hooks/use-admin";
import { APP_DOMAIN } from "@/lib/config";
import { createAccountSchema, type CreateAccountFormValues } from "@/lib/validation";

export default function CreateAccountPage() {
  const router = useRouter();
  const createAccount = useCreateAccount();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CreateAccountFormValues>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      displayName: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const created = await createAccount.mutateAsync({
        username: values.username.trim().toLowerCase(),
        password: values.password,
        displayName: values.displayName?.trim() || undefined,
      });
      toast.success(`Created ${created.email}`);
      router.push("/admin/accounts");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create account";
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-muted-foreground">
          Provisions a customer login and private mailbox together.
        </p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">New account</CardTitle>
          <CardDescription>
            One account = one login = one private mailbox at @{APP_DOMAIN}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                <Input
                  id="username"
                  className="border-0 shadow-none focus-visible:ring-0"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="username"
                  {...form.register("username", {
                    setValueAs: (v) => String(v ?? "").trim().toLowerCase(),
                    onChange: (e) => {
                      e.target.value = String(e.target.value ?? "").toLowerCase();
                    },
                  })}
                />
                <span className="flex items-center border-l border-input bg-muted/40 px-3 text-sm text-muted-foreground whitespace-nowrap">
                  @{APP_DOMAIN}
                </span>
              </div>
              {form.formState.errors.username ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.username.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, dots, hyphens, or underscores.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display name (optional)</Label>
              <Input
                id="displayName"
                autoComplete="off"
                placeholder="Optional"
                {...form.register("displayName")}
              />
              {form.formState.errors.displayName ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.displayName.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
              ) : (
                <p className="text-xs text-muted-foreground">At least 10 characters.</p>
              )}
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

            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                {formError}
              </div>
            ) : null}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createAccount.isPending}>
                {createAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create account
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/accounts">Cancel</Link>
              </Button>
              <Button type="button" variant="ghost" asChild>
                <Link href="/admin/accounts/bulk">Bulk create instead</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
