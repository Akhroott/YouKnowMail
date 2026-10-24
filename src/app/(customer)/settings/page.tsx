"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Shield, Smartphone } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccount } from "@/hooks/use-messages";
import { api } from "@/lib/api/client";
import {
  changePasswordSchema,
  preferencesSchema,
  type ChangePasswordFormValues,
  type PreferencesFormValues,
} from "@/lib/validation";
import { formatRelativeTime } from "@/lib/utils";

export default function SettingsPage() {
  const { data: account, refetch, isLoading } = useAccount();
  const { setTheme } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();
  const [setup, setSetup] = useState<{
    secret: string;
    qrDataUrl: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const prefsForm = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      theme: "system",
      dateTimeFormat: "relative",
      inboxDensity: "comfortable",
      showImages: true,
      markReadOnOpen: true,
    },
  });

  useEffect(() => {
    if (account?.preferences) {
      prefsForm.reset(account.preferences);
    }
  }, [account, prefsForm]);

  if (isLoading || !account) {
    return <div className="p-6 text-sm text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 pl-14 sm:p-6 lg:pl-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage account security and inbox preferences.
        </p>
      </div>

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Mailbox identity is assigned by your administrator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Login email</Label>
                  <Input value={account.email} readOnly className="mt-1.5 bg-muted/40" />
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1.5">
                    <Badge variant={account.status === "active" ? "success" : "warning"}>
                      {account.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Created</Label>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {new Date(account.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label>Last login</Label>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {account.lastLoginAt
                      ? `${new Date(account.lastLoginAt).toLocaleString()} (${formatRelativeTime(account.lastLoginAt)})`
                      : "Never"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={passwordForm.handleSubmit(async (values) => {
                  await api.account.changePassword(values);
                  passwordForm.reset();
                  toast.success("Password update submitted");
                })}
              >
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    {...passwordForm.register("currentPassword")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...passwordForm.register("newPassword")}
                  />
                  {passwordForm.formState.errors.newPassword ? (
                    <p className="text-xs text-destructive">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...passwordForm.register("confirmPassword")}
                  />
                </div>
                <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                  {passwordForm.formState.isSubmitting ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Update password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Authenticator 2FA
              </CardTitle>
              <CardDescription>
                Protect sign-in with a time-based one-time password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-xs text-muted-foreground">
                    {account.twoFactorEnabled ? "Enabled" : "Not enabled"}
                  </p>
                </div>
                <Badge variant={account.twoFactorEnabled ? "success" : "secondary"}>
                  {account.twoFactorEnabled ? "On" : "Off"}
                </Badge>
              </div>

              {!setup && !recoveryCodes && !account.twoFactorEnabled ? (
                <Button
                  onClick={async () => {
                    try {
                      const result = await api.auth.setup2FA();
                      setSetup({ secret: result.secret, qrDataUrl: result.qrDataUrl });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not start 2FA setup");
                    }
                  }}
                >
                  <Smartphone className="h-4 w-4" />
                  Enable authenticator
                </Button>
              ) : null}

              {account.twoFactorEnabled && !setup && !recoveryCodes ? (
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication is enabled. Reconfiguration requires a verified recovery
                  flow on the server.
                </p>
              ) : null}

              {setup ? (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={setup.qrDataUrl}
                    alt="Authenticator QR code"
                    className="h-40 w-40 rounded-lg border border-border bg-white"
                  />
                  <p className="text-xs text-muted-foreground">
                    Secret: <span className="font-mono">{setup.secret}</span>
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="totp">Verify code</Label>
                    <Input
                      id="totp"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="123456"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      try {
                        const result = await api.auth.verify2FASetup(totpCode);
                        setRecoveryCodes(result.recoveryCodes);
                        setSetup(null);
                        setTotpCode("");
                        await refetch();
                        toast.success("2FA enabled");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Verification failed");
                      }
                    }}
                  >
                    Verify and enable
                  </Button>
                </div>
              ) : null}

              {recoveryCodes ? (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm font-medium">Recovery codes</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Store these securely. They are shown once and never logged.
                  </p>
                  <ul className="mt-3 grid gap-1 font-mono text-sm sm:grid-cols-2">
                    {recoveryCodes.map((code) => (
                      <li key={code}>{code}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Recovery codes remaining: {account.recoveryCodesRemaining}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active sessions</CardTitle>
              <CardDescription>Devices currently signed in to your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {account.sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {session.device} · {session.browser}
                      {session.current ? (
                        <Badge className="ml-2" variant="secondary">
                          Current
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.location} · {session.ip} · {formatRelativeTime(session.lastActiveAt)}
                    </p>
                  </div>
                </div>
              ))}
              <Separator />
              <Button
                variant="outline"
                onClick={async () => {
                  await api.account.revokeOtherSessions();
                  await refetch();
                  toast.success("Other sessions signed out");
                }}
              >
                Log out other sessions
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await logout();
                  router.push("/login");
                }}
              >
                Sign out everywhere
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-5"
                onSubmit={prefsForm.handleSubmit(async (values) => {
                  setSavingPrefs(true);
                  try {
                    await api.account.update({ preferences: values });
                    setTheme(values.theme);
                    await refetch();
                    toast.success("Preferences saved");
                  } finally {
                    setSavingPrefs(false);
                  }
                })}
              >
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={prefsForm.watch("theme")}
                    onValueChange={(value) =>
                      prefsForm.setValue("theme", value as PreferencesFormValues["theme"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date and time format</Label>
                  <Select
                    value={prefsForm.watch("dateTimeFormat")}
                    onValueChange={(value) =>
                      prefsForm.setValue(
                        "dateTimeFormat",
                        value as PreferencesFormValues["dateTimeFormat"]
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relative">Relative</SelectItem>
                      <SelectItem value="absolute">Absolute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Inbox density</Label>
                  <Select
                    value={prefsForm.watch("inboxDensity")}
                    onValueChange={(value) =>
                      prefsForm.setValue(
                        "inboxDensity",
                        value as PreferencesFormValues["inboxDensity"]
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Show remote images</p>
                    <p className="text-xs text-muted-foreground">
                      On by default so HTML emails render fully. Turn off to block trackers.
                    </p>
                  </div>
                  <Switch
                    checked={prefsForm.watch("showImages")}
                    onCheckedChange={(checked) => prefsForm.setValue("showImages", checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Mark as read on open</p>
                    <p className="text-xs text-muted-foreground">
                      Automatically mark messages when opened.
                    </p>
                  </div>
                  <Switch
                    checked={prefsForm.watch("markReadOnOpen")}
                    onCheckedChange={(checked) => prefsForm.setValue("markReadOnOpen", checked)}
                  />
                </div>

                <Button type="submit" disabled={savingPrefs}>
                  {savingPrefs ? <Loader2 className="animate-spin" /> : null}
                  Save preferences
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
