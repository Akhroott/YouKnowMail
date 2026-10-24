"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  KeyRound,
  Layers,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminAccounts,
  useSetAccountPassword,
  useUpdateCustomerStatus,
  useUpdateOwnerRole,
  useUpdateOwnerStatus,
} from "@/hooks/use-admin";
import { isOwnerRole } from "@/lib/auth/roles";
import { DEFAULT_PAGE_SIZE } from "@/lib/config";
import type { AccountStatus, AdminAccountListItem, UserRole } from "@/lib/types";
import {
  setAccountPasswordSchema,
  type SetAccountPasswordFormValues,
} from "@/lib/validation";

function statusVariant(status: AccountStatus) {
  return status === "active"
    ? ("success" as const)
    : status === "suspended"
      ? ("danger" as const)
      : ("warning" as const);
}

export default function AdminAccountsPage() {
  const { user } = useAuth();
  const isOwner = isOwnerRole(user?.role);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    [search, page]
  );

  const { data, isLoading, isFetching } = useAdminAccounts(params);
  const updateCustomerStatus = useUpdateCustomerStatus();
  const updateOwnerRole = useUpdateOwnerRole();
  const updateOwnerStatus = useUpdateOwnerStatus();
  const setAccountPassword = useSetAccountPassword();
  const [passwordTarget, setPasswordTarget] = useState<AdminAccountListItem | null>(null);

  const passwordForm = useForm<SetAccountPasswordFormValues>({
    resolver: zodResolver(setAccountPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const accounts = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const busy =
    updateCustomerStatus.isPending ||
    updateOwnerRole.isPending ||
    updateOwnerStatus.isPending ||
    setAccountPassword.isPending;

  const setStatus = (id: string, role: UserRole, status: "active" | "suspended") => {
    if (isOwner) {
      updateOwnerStatus.mutate(
        { userId: id, status },
        {
          onSuccess: () =>
            toast.success(status === "active" ? "Account reactivated" : "Account suspended"),
          onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
        }
      );
      return;
    }
    // Admins may only change customer status via PATCH /admin/customers/{id}
    if (role !== "customer") {
      toast.error("Admins can only change customer account status");
      return;
    }
    updateCustomerStatus.mutate(
      { id, status },
      {
        onSuccess: () =>
          toast.success(status === "active" ? "Account reactivated" : "Account suspended"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
      }
    );
  };

  const setRole = (userId: string, role: UserRole) => {
    updateOwnerRole.mutate(
      { userId, role },
      {
        onSuccess: () => toast.success(`Role updated to ${role}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Role update failed"),
      }
    );
  };

  const canSetPassword = (account: AdminAccountListItem) => {
    if (isOwner) return true;
    return account.role === "customer" && !account.ownerProtected;
  };

  const canAdminChangeStatus = (account: AdminAccountListItem) => {
    if (isOwner) return true;
    return account.role === "customer" && !account.ownerProtected;
  };

  const openPasswordDialog = (account: AdminAccountListItem) => {
    passwordForm.reset({ password: "", confirmPassword: "" });
    setPasswordTarget(account);
  };

  const onSetPassword = passwordForm.handleSubmit(async (values) => {
    if (!passwordTarget) return;
    try {
      await setAccountPassword.mutateAsync({
        userId: passwordTarget.id,
        password: values.password,
      });
      toast.success(`Password updated for ${passwordTarget.email}`);
      setPasswordTarget(null);
      passwordForm.reset({ password: "", confirmPassword: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Password update failed");
    }
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Each account is one login with one private mailbox. Create via the unified flow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/accounts/bulk">
              <Layers className="h-4 w-4" />
              Bulk create
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/accounts/create">
              <Plus className="h-4 w-4" />
              Create account
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">All accounts</CardTitle>
            <CardDescription>
              {data?.total ?? 0} total
              {isOwner ? " · Owner role & status controls enabled" : " · Customer status only"}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, or mailbox…"
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
                  <th className="px-6 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Mailbox</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td colSpan={5} className="px-6 py-4">
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  : accounts.map((account) => {
                      const role = account.role;
                      const isSelf = account.id === user?.id;
                      const canChangeStatus = canAdminChangeStatus(account);
                      const canPassword = canSetPassword(account);
                      const hasActions = canChangeStatus || isOwner || canPassword;
                      return (
                        <tr
                          key={account.id}
                          className="border-b border-border/60 hover:bg-muted/30"
                        >
                          <td className="px-6 py-3">
                            <p className="font-medium">{account.displayName || account.email}</p>
                            <p className="text-xs text-muted-foreground">{account.email}</p>
                            {account.ownerProtected && !isOwner ? (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                Owner-managed — view only
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="capitalize">
                              {role}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={statusVariant(account.status)}
                              className="capitalize"
                            >
                              {account.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {account.mailboxAddress ?? "—"}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {hasActions ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Account actions"
                                    disabled={busy}
                                  >
                                    {busy ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <MoreHorizontal className="h-4 w-4" />
                                    )}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  {canPassword ? (
                                    <DropdownMenuItem onClick={() => openPasswordDialog(account)}>
                                      <KeyRound className="mr-2 h-4 w-4" />
                                      Set password
                                    </DropdownMenuItem>
                                  ) : null}
                                  {canChangeStatus ? (
                                    account.status === "suspended" ? (
                                      <DropdownMenuItem
                                        disabled={isSelf}
                                        onClick={() => setStatus(account.id, role, "active")}
                                      >
                                        <PlayCircle className="mr-2 h-4 w-4" />
                                        Reactivate
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        disabled={isSelf}
                                        onClick={() => setStatus(account.id, role, "suspended")}
                                      >
                                        <PauseCircle className="mr-2 h-4 w-4" />
                                        Suspend
                                      </DropdownMenuItem>
                                    )
                                  ) : null}
                                  {isOwner ? (
                                    <>
                                      <DropdownMenuSeparator />
                                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                        Change role
                                      </p>
                                      {role !== "customer" ? (
                                        <DropdownMenuItem
                                          disabled={isSelf}
                                          onClick={() => setRole(account.id, "customer")}
                                        >
                                          Demote to customer
                                        </DropdownMenuItem>
                                      ) : null}
                                      {role !== "admin" ? (
                                        <DropdownMenuItem
                                          disabled={isSelf}
                                          onClick={() => setRole(account.id, "admin")}
                                        >
                                          {role === "owner"
                                            ? "Demote to admin"
                                            : "Promote to admin"}
                                        </DropdownMenuItem>
                                      ) : null}
                                      {role !== "owner" ? (
                                        <DropdownMenuItem
                                          disabled={isSelf || account.status !== "active"}
                                          onClick={() => setRole(account.id, "owner")}
                                        >
                                          Promote to owner
                                        </DropdownMenuItem>
                                      ) : null}
                                    </>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {!isLoading && accounts.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No accounts found.
            </p>
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

      <Dialog
        open={!!passwordTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null);
            passwordForm.reset({ password: "", confirmPassword: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set password</DialogTitle>
            <DialogDescription>
              Manually set a new password for{" "}
              <span className="font-medium text-foreground">{passwordTarget?.email}</span>. All
              active sessions for this account will be signed out.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSetPassword} className="space-y-4" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="admin-set-password">New password</Label>
              <Input
                id="admin-set-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("password")}
              />
              {passwordForm.formState.errors.password ? (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.password.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-set-password-confirm">Confirm password</Label>
              <Input
                id="admin-set-password-confirm"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("confirmPassword")}
              />
              {passwordForm.formState.errors.confirmPassword ? (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordTarget(null)}
                disabled={setAccountPassword.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={setAccountPassword.isPending}>
                {setAccountPassword.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
