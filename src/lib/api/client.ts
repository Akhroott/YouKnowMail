/**
 * Live YoyKnowMail API client.
 * Contract: backend-reference/schemas.py + backend-reference/routers/*
 *
 * - credentials: "include" (HttpOnly session cookie)
 * - CSRF: X-CSRF-Token from ykm_csrf cookie on mutating methods
 * - No mock/demo fallbacks — failures surface as ApiClientError
 */
import {
  API_BASE_URL,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  DEFAULT_PREFERENCES,
} from "@/lib/config";
import type {
  AccountPreferences,
  AdminAccountListItem,
  BulkCreateAccountsRequest,
  BulkCreateAccountsResult,
  CreateUnifiedAccountRequest,
  CreatedUnifiedAccount,
  CustomerAccount,
  Invitation,
  LoginRequest,
  LoginResponse,
  Mailbox,
  Message,
  MessageListParams,
  MessageUpdate,
  OwnerManagedAccount,
  PaginatedResponse,
  TwoFactorVerifyRequest,
  UserAccount,
  UserRole,
  AdminStats,
  AuditLogEntry,
} from "@/lib/types";

class ApiClientError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE_URL) return normalized;
  return `${API_BASE_URL}${normalized}`;
}

async function parseError(response: Response): Promise<ApiClientError> {
  let message = "Request failed";
  let code: string | undefined;
  try {
    const body = (await response.json()) as {
      message?: string;
      detail?: string | { msg?: string }[];
      code?: string;
    };
    if (typeof body.detail === "string") message = body.detail;
    else if (Array.isArray(body.detail) && body.detail[0]?.msg) message = body.detail[0].msg;
    else message = body.message ?? message;
    code = body.code;
  } catch {
    if (response.status === 429) message = "Too many attempts. Please wait and try again.";
    else if (response.status >= 500) message = "Server error. Please try again later.";
    else message = `Request failed (${response.status})`;
  }
  return new ApiClientError(message, code, response.status);
}

function redirectToLoginIfNeeded(status: number) {
  if (status !== 401 || typeof window === "undefined") return;
  const path = window.location.pathname;
  const onAuthPage =
    path.startsWith("/login") ||
    path.startsWith("/invite") ||
    path.startsWith("/forgot-password");
  if (!onAuthPage) {
    window.location.assign("/login");
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };

  const hasBody = init?.body !== undefined && init?.body !== null;
  if (hasBody && !headers["Content-Type"] && !(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // CSRF required for state-changing requests after session cookies are set
  // (login itself has no CSRF cookie yet — backend does not require it there).
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrf = readCookie(CSRF_COOKIE_NAME);
    if (csrf) headers[CSRF_HEADER_NAME] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiClientError(
      "Unable to reach the YoyKnowMail API. Check your connection and API URL.",
      "NETWORK"
    );
  }

  if (!response.ok) {
    redirectToLoginIfNeeded(response.status);
    throw await parseError(response);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function normalizePreferences(raw: unknown): AccountPreferences {
  const prefs = raw && typeof raw === "object" ? (raw as Partial<AccountPreferences>) : {};
  return {
    theme: prefs.theme ?? DEFAULT_PREFERENCES.theme,
    dateTimeFormat: prefs.dateTimeFormat ?? DEFAULT_PREFERENCES.dateTimeFormat,
    inboxDensity: prefs.inboxDensity ?? DEFAULT_PREFERENCES.inboxDensity,
    showImages: prefs.showImages ?? DEFAULT_PREFERENCES.showImages,
    markReadOnOpen: prefs.markReadOnOpen ?? DEFAULT_PREFERENCES.markReadOnOpen,
  };
}

function normalizeAccount(raw: CustomerAccount): CustomerAccount {
  return {
    ...raw,
    preferences: normalizePreferences(raw.preferences),
    recoveryCodesRemaining: raw.recoveryCodesRemaining ?? 0,
    sessions: raw.sessions ?? [],
  };
}

/** Typed live API surface matching backend-reference routers. */
export const api = {
  auth: {
    /** POST /auth/login — sets session + CSRF cookies when 2FA not required */
    login(payload: LoginRequest): Promise<LoginResponse> {
      return request("/auth/login", { method: "POST", body: JSON.stringify(payload) });
    },
    /** GET /auth/me */
    me(): Promise<UserAccount> {
      return request("/auth/me");
    },
    /** POST /auth/2fa/verify — login completion or setup confirm when setup=true */
    verify2FA(payload: TwoFactorVerifyRequest): Promise<{ user: UserAccount }> {
      return request("/auth/2fa/verify", { method: "POST", body: JSON.stringify(payload) });
    },
    /** POST /auth/logout — requires CSRF when session present */
    logout(): Promise<void> {
      return request("/auth/logout", { method: "POST" });
    },
    /** POST /auth/2fa/setup — 409 if already enabled */
    setup2FA() {
      return request<{ secret: string; otpauthUrl: string; qrDataUrl: string }>("/auth/2fa/setup", {
        method: "POST",
      });
    },
    verify2FASetup(code: string) {
      return request<{ recoveryCodes: string[] }>("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code, setup: true }),
      });
    },
  },

  mailbox: {
    /** GET /mailbox — caller's own mailbox only */
    get(mailboxId?: string | null): Promise<Mailbox> {
      const q = mailboxId ? `?mailboxId=${encodeURIComponent(mailboxId)}` : "";
      return request(`/mailbox${q}`);
    },
    /** GET /mailboxes — caller's owned mailboxes only */
    list(): Promise<{ data: Mailbox[] }> {
      return request("/mailboxes");
    },
  },

  messages: {
    /**
     * GET /messages
     * folder: inbox | unread | starred | archive | trash
     */
    list(
      params: MessageListParams & { mailboxId?: string } = {}
    ): Promise<PaginatedResponse<Message>> {
      const query = new URLSearchParams();
      if (params.folder) query.set("folder", params.folder);
      if (params.search) query.set("search", params.search);
      if (params.page) query.set("page", String(params.page));
      if (params.pageSize) query.set("pageSize", String(params.pageSize));
      if (params.mailboxId) query.set("mailboxId", params.mailboxId);
      const qs = query.toString();
      return request(`/messages${qs ? `?${qs}` : ""}`);
    },
    get(id: string): Promise<Message> {
      return request(`/messages/${encodeURIComponent(id)}`);
    },
    /** PATCH — isRead / isStarred / folder (inbox|archive|trash only) */
    update(id: string, update: MessageUpdate): Promise<Message> {
      return request(`/messages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      });
    },
    /** DELETE — soft-delete to trash */
    delete(id: string): Promise<void> {
      return request(`/messages/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  },

  account: {
    async get(): Promise<CustomerAccount> {
      return normalizeAccount(await request("/account"));
    },
    async update(patch: Partial<{ preferences: AccountPreferences; displayName: string }>) {
      return normalizeAccount(
        await request("/account", { method: "PATCH", body: JSON.stringify(patch) })
      );
    },
    changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
      return request("/account/password", { method: "POST", body: JSON.stringify(payload) });
    },
    revokeOtherSessions(): Promise<void> {
      return request("/account/sessions/revoke", { method: "POST" });
    },
  },

  admin: {
    stats(): Promise<AdminStats> {
      return request("/admin/stats");
    },
    /**
     * GET /admin/accounts — all roles (customer/admin/owner), paginated
     * Safe fields only: id, email, displayName, role, status, mailboxId, mailboxAddress
     */
    accounts(params: { search?: string; page?: number; pageSize?: number } = {}) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") query.set(k, String(v));
      });
      const qs = query.toString();
      return request<PaginatedResponse<AdminAccountListItem>>(
        `/admin/accounts${qs ? `?${qs}` : ""}`
      );
    },
    /** PATCH /admin/customers/{id} — status for customer accounts only */
    updateCustomerStatus(id: string, status: "active" | "suspended") {
      return request<CustomerAccount>(`/admin/customers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    /**
     * POST /admin/accounts
     * Body (CreateAccountRequest): username, password, displayName
     * Response: id, email, role, status, mailboxId, mailboxAddress
     */
    createAccount(payload: CreateUnifiedAccountRequest) {
      return request<CreatedUnifiedAccount>("/admin/accounts", {
        method: "POST",
        body: JSON.stringify({
          username: payload.username.trim().toLowerCase(),
          password: payload.password,
          displayName: payload.displayName?.trim() ?? "",
        }),
      });
    },
    /**
     * POST /admin/accounts/bulk
     * Creates many customer logins + private mailboxes.
     * Response includes plaintext passwords once for export.
     */
    bulkCreateAccounts(payload: BulkCreateAccountsRequest) {
      return request<BulkCreateAccountsResult>("/admin/accounts/bulk", {
        method: "POST",
        body: JSON.stringify({
          prefix: payload.prefix.trim().toLowerCase(),
          count: payload.count,
          startIndex: payload.startIndex ?? 1,
          padWidth: payload.padWidth ?? 3,
          useRandom: payload.useRandom ?? false,
          passwordMode: payload.passwordMode,
          password: payload.password,
          displayNamePrefix: payload.displayNamePrefix?.trim() ?? "",
        }),
      });
    },
    /**
     * POST /admin/accounts/{id}/password — admin sets customer password;
     * owners may set any account password. Sessions revoked. No password in response.
     */
    setAccountPassword(userId: string, password: string) {
      return request<void>(`/admin/accounts/${encodeURIComponent(userId)}/password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
    },
    /**
     * PATCH /admin/owners/{id}/role — owner only
     * Body (UpdateRoleRequest): role = customer | admin | owner
     */
    updateOwnerRole(userId: string, role: UserRole) {
      return request<OwnerManagedAccount>(
        `/admin/owners/${encodeURIComponent(userId)}/role`,
        { method: "PATCH", body: JSON.stringify({ role }) }
      );
    },
    /**
     * PATCH /admin/owners/{id}/status — owner only
     * Body (UpdateStatusRequest): status = active | suspended
     */
    updateOwnerStatus(userId: string, status: "active" | "suspended") {
      return request<OwnerManagedAccount>(
        `/admin/owners/${encodeURIComponent(userId)}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) }
      );
    },
    auditLogs(params: { search?: string; page?: number; pageSize?: number } = {}) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") query.set(k, String(v));
      });
      const qs = query.toString();
      return request<PaginatedResponse<AuditLogEntry>>(
        `/admin/audit-logs${qs ? `?${qs}` : ""}`
      );
    },
  },

  invitations: {
    get(token: string) {
      return request<Invitation>(`/invitations/${encodeURIComponent(token)}`);
    },
    accept(token: string, password: string) {
      return request<{ requires2FASetup: true }>(
        `/invitations/${encodeURIComponent(token)}/accept`,
        { method: "POST", body: JSON.stringify({ password }) }
      );
    },
  },
};

export { ApiClientError };
