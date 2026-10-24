"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import { APP_DOMAIN, APP_NAME } from "@/lib/config";
import type { Invitation } from "@/lib/types";
import {
  invitationPasswordSchema,
  type InvitationPasswordFormValues,
} from "@/lib/validation";

type Step = "loading" | "password" | "2fa" | "done" | "error";

function InviteContent() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const [step, setStep] = useState<Step>("loading");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState("");

  const form = useForm<InvitationPasswordFormValues>({
    resolver: zodResolver(invitationPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const invite = await api.invitations.get(token);
        if (cancelled) return;
        setInvitation(invite);
        setStep("password");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Invalid invitation");
        setStep("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader>
              <CardTitle>Join {APP_NAME}</CardTitle>
              <CardDescription>
                Accept your mailbox invitation, set a password, and enroll two-factor authentication.
                This link can be used once.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === "loading" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating invitation…
                </div>
              ) : null}

              {step === "error" ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              ) : null}

              {invitation && step !== "error" ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium">{invitation.mailboxAddress}</p>
                  <p className="text-muted-foreground">{invitation.customerEmail}</p>
                </div>
              ) : null}

              {step === "password" ? (
                <form
                  className="space-y-3"
                  onSubmit={form.handleSubmit(async (values) => {
                    await api.invitations.accept(token, values.password);
                    const result = await api.auth.setup2FA();
                    setSetup({ secret: result.secret, qrDataUrl: result.qrDataUrl });
                    setStep("2fa");
                    toast.success("Password saved. Enroll 2FA to finish.");
                  })}
                >
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" {...form.register("password")} />
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
                      {...form.register("confirmPassword")}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                    Continue
                  </Button>
                </form>
              ) : null}

              {step === "2fa" && setup ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    Enroll authenticator
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={setup.qrDataUrl}
                    alt="Authenticator QR"
                    className="h-40 w-40 rounded-lg border border-border bg-white"
                  />
                  <p className="text-xs text-muted-foreground font-mono">{setup.secret}</p>
                  <div className="space-y-2">
                    <Label htmlFor="code">Verification code</Label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={async () => {
                      try {
                        await api.auth.verify2FASetup(code);
                        setStep("done");
                        toast.success("Mailbox ready");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Invalid code");
                      }
                    }}
                  >
                    Finish setup
                  </Button>
                </div>
              ) : null}

              {step === "done" ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                    Invitation accepted. Existing sessions for prior ownership are revoked. You can
                    now sign in.
                  </div>
                  <Button className="w-full" onClick={() => router.push("/login")}>
                    Go to sign in
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      </main>
      <footer className="px-6 pb-6 text-center text-xs text-muted-foreground">
        {APP_NAME} · {APP_DOMAIN}
      </footer>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading invitation…
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
