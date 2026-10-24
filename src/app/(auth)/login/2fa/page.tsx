"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { homePathForRole } from "@/lib/auth/roles";
import { twoFactorSchema, type TwoFactorFormValues } from "@/lib/validation";

export default function TwoFactorPage() {
  const router = useRouter();
  const { verify2FA } = useAuth();
  const [method, setMethod] = useState<"totp" | "recovery">("totp");
  const [error, setError] = useState<string | null>(null);
  const [missingToken] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("ykm.auth.tempToken");
  });

  const form = useForm<TwoFactorFormValues>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const tempToken = sessionStorage.getItem("ykm.auth.tempToken");
    if (!tempToken) {
      setError("Session expired. Please sign in again.");
      return;
    }
    setError(null);
    try {
      const user = await verify2FA(tempToken, values.code.trim(), method);
      sessionStorage.removeItem("ykm.auth.tempToken");
      sessionStorage.removeItem("ykm.auth.email");
      toast.success("Verified");
      router.push(homePathForRole(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    }
  });

  if (missingToken) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Session expired</CardTitle>
          <CardDescription>Please sign in again to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-md"
    >
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Enter the code from your authenticator app or use a recovery code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={method}
            onValueChange={(value) => {
              setMethod(value as "totp" | "recovery");
              form.reset({ code: "" });
              setError(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="totp">Authenticator</TabsTrigger>
              <TabsTrigger value="recovery">Recovery code</TabsTrigger>
            </TabsList>
            <TabsContent value="totp">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Authentication code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={8}
                    {...form.register("code")}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                  Verify and continue
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="recovery">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery">Recovery code</Label>
                  <Input
                    id="recovery"
                    placeholder="YKM-RECOVER-01"
                    {...form.register("code")}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                  Use recovery code
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
