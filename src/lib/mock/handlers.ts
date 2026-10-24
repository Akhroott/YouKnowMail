import { delay } from "@/lib/utils";
import type {
  AccountPreferences,
  CustomerAccount,
  Invitation,
  LoginRequest,
  LoginResponse,
  Mailbox,
  Message,
  MessageListParams,
  MessageUpdate,
  PaginatedResponse,
  TwoFactorVerifyRequest,
  UserAccount,
} from "@/lib/types";

/** Legacy mock-only shapes (disabled in live API). */
type LegacyCreateMailboxRequest = {
  username: string;
  domain: string;
  customerId?: string | null;
  status?: Mailbox["status"];
};
type LegacyBulkMailboxRequest = {
  count: number;
  prefix: string;
  domain: string;
  useRandom: boolean;
};
type LegacyBulkMailboxResult = {
  created: Mailbox[];
  skipped: string[];
  progress: number;
};
import {
  getMockAdminStats,
  MOCK_CREDENTIALS,
  mockAdminUser,
  mockAuditLogs,
  mockCustomer,
  mockCustomers,
  mockInvitations,
  mockMailboxes,
  mockMessages,
} from "./data";

const LATENCY = 350;

function paginate<T>(items: T[], page = 1, pageSize = 20): PaginatedResponse<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

function randomUsername(prefix = "user"): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${suffix}`;
}

export const mockApi = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    await delay(LATENCY);
    const email = payload.email.toLowerCase().trim();

    if (
      email === MOCK_CREDENTIALS.customer.email &&
      payload.password === MOCK_CREDENTIALS.customer.password
    ) {
      return { requires2FA: true, tempToken: "mock-customer-temp" };
    }

    if (
      email === MOCK_CREDENTIALS.admin.email &&
      payload.password === MOCK_CREDENTIALS.admin.password
    ) {
      return { requires2FA: true, tempToken: "mock-admin-temp" };
    }

    throw new Error("Invalid email or password");
  },

  async verify2FA(payload: TwoFactorVerifyRequest): Promise<{ user: UserAccount }> {
    await delay(LATENCY);
    const isCustomer = payload.tempToken === "mock-customer-temp";
    const isAdmin = payload.tempToken === "mock-admin-temp";

    if (!isCustomer && !isAdmin) {
      throw new Error("Session expired. Please sign in again.");
    }

    if (payload.method === "recovery") {
      if (
        !isCustomer ||
        payload.code.toUpperCase() !== MOCK_CREDENTIALS.customer.recovery
      ) {
        throw new Error("Invalid recovery code");
      }
      return { user: { ...mockCustomer } };
    }

    const expected = isAdmin
      ? MOCK_CREDENTIALS.admin.totp
      : MOCK_CREDENTIALS.customer.totp;

    if (payload.code !== expected) {
      throw new Error("Invalid authentication code");
    }

    return { user: isAdmin ? { ...mockAdminUser } : { ...mockCustomer } };
  },

  async logout(): Promise<void> {
    await delay(200);
  },

  async getMailbox(): Promise<Mailbox> {
    await delay(LATENCY);
    const mailbox = mockMailboxes.find((m) => m.id === mockCustomer.mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");
    return { ...mailbox };
  },

  async getMessages(params: MessageListParams = {}): Promise<PaginatedResponse<Message>> {
    await delay(LATENCY);
    const { folder = "inbox", search = "", page = 1, pageSize = 20 } = params;
    let items = mockMessages.filter((m) => m.mailboxId === "mbx-1");

    if (folder === "unread") {
      items = items.filter((m) => !m.isRead && m.folder === "inbox");
    } else if (folder === "starred") {
      items = items.filter((m) => m.isStarred && m.folder !== "trash");
    } else {
      items = items.filter((m) => m.folder === folder);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.from.name.toLowerCase().includes(q) ||
          m.from.address.toLowerCase().includes(q) ||
          m.preview.toLowerCase().includes(q)
      );
    }

    items = [...items].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );

    return paginate(items, page, pageSize);
  },

  async getMessage(id: string): Promise<Message> {
    await delay(LATENCY);
    const message = mockMessages.find((m) => m.id === id && m.mailboxId === "mbx-1");
    if (!message) throw new Error("Message not found");
    return { ...message };
  },

  async updateMessage(id: string, update: MessageUpdate): Promise<Message> {
    await delay(250);
    const index = mockMessages.findIndex((m) => m.id === id && m.mailboxId === "mbx-1");
    if (index === -1) throw new Error("Message not found");
    mockMessages[index] = { ...mockMessages[index], ...update };
    return { ...mockMessages[index] };
  },

  async deleteMessage(id: string): Promise<void> {
    await delay(250);
    const index = mockMessages.findIndex((m) => m.id === id && m.mailboxId === "mbx-1");
    if (index === -1) throw new Error("Message not found");
    if (mockMessages[index].folder === "trash") {
      mockMessages.splice(index, 1);
    } else {
      mockMessages[index] = { ...mockMessages[index], folder: "trash", isRead: true };
    }
  },

  async getAccount(): Promise<CustomerAccount> {
    await delay(LATENCY);
    return {
      ...mockCustomer,
      sessions: [...mockCustomer.sessions],
      preferences: { ...mockCustomer.preferences },
    };
  },

  async updateAccount(
    patch: Partial<{ preferences: AccountPreferences; displayName: string }>
  ): Promise<CustomerAccount> {
    await delay(LATENCY);
    if (patch.preferences) mockCustomer.preferences = patch.preferences;
    if (patch.displayName) mockCustomer.displayName = patch.displayName;
    return mockApi.getAccount();
  },

  async changePassword(): Promise<void> {
    await delay(LATENCY);
    // Mock acknowledges request without claiming production success semantics beyond UI demo
  },

  async setup2FA(): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
    await delay(LATENCY);
    const secret = "JBSWY3DPEHPK3PXP";
    return {
      secret,
      otpauthUrl: `otpauth://totp/YoyKnowMail:${mockCustomer.email}?secret=${secret}&issuer=YoyKnowMail`,
      qrDataUrl:
        "data:image/svg+xml," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#fff"/><rect x="16" y="16" width="40" height="40" fill="#111"/><rect x="104" y="16" width="40" height="40" fill="#111"/><rect x="16" y="104" width="40" height="40" fill="#111"/><rect x="64" y="64" width="32" height="32" fill="#111"/><text x="80" y="150" text-anchor="middle" font-size="10" fill="#666">Demo QR</text></svg>`
        ),
    };
  },

  async verify2FASetup(code: string): Promise<{ recoveryCodes: string[] }> {
    await delay(LATENCY);
    if (code !== MOCK_CREDENTIALS.customer.totp) {
      throw new Error("Invalid authenticator code");
    }
    mockCustomer.twoFactorEnabled = true;
    mockCustomer.recoveryCodesRemaining = 10;
    return {
      recoveryCodes: Array.from({ length: 10 }, (_, i) =>
        `YKM-${String(i + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      ),
    };
  },

  async revokeOtherSessions(): Promise<void> {
    await delay(LATENCY);
    mockCustomer.sessions = mockCustomer.sessions.filter((s) => s.current);
  },

  async getAdminStats() {
    await delay(LATENCY);
    return getMockAdminStats();
  },

  async getAdminMailboxes(params: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<PaginatedResponse<Mailbox>> {
    await delay(LATENCY);
    let items = [...mockMailboxes];
    if (params.status && params.status !== "all") {
      items = items.filter((m) => m.status === params.status);
    }
    if (params.search?.trim()) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (m) =>
          m.address.toLowerCase().includes(q) ||
          m.customerName?.toLowerCase().includes(q) ||
          m.customerEmail?.toLowerCase().includes(q)
      );
    }
    items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return paginate(items, params.page, params.pageSize);
  },

  async createMailbox(payload: LegacyCreateMailboxRequest): Promise<Mailbox> {
    await delay(LATENCY);
    const address = `${payload.username}@${payload.domain}`;
    if (mockMailboxes.some((m) => m.address === address)) {
      throw new Error("Mailbox address already exists");
    }
    const customer = payload.customerId
      ? mockCustomers.find((c) => c.id === payload.customerId)
      : null;
    const mailbox: Mailbox = {
      id: `mbx-${Date.now()}`,
      address,
      username: payload.username,
      domain: payload.domain,
      customerId: customer?.id ?? null,
      customerName: customer?.displayName ?? null,
      customerEmail: customer?.email ?? null,
      status: payload.status ?? (customer ? "pending_invite" : "unassigned"),
      ownershipStatus: customer ? "invitation_pending" : "unassigned",
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      messageCount: 0,
      storageUsed: 0,
      storageLimit: 100_000_000,
    };
    mockMailboxes.unshift(mailbox);
    mockAuditLogs.unshift({
      id: `log-${Date.now()}`,
      action: "mailbox_created",
      actor: "admin@yoyknowmail.com",
      actorRole: "admin",
      target: address,
      metadata: { domain: payload.domain },
      ip: "192.0.2.10",
      createdAt: new Date().toISOString(),
      success: true,
    });
    return mailbox;
  },

  async bulkCreateMailboxes(payload: LegacyBulkMailboxRequest): Promise<LegacyBulkMailboxResult> {
    await delay(600);
    const created: Mailbox[] = [];
    const skipped: string[] = [];
    const limit = Math.min(payload.count, 100);

    for (let i = 0; i < limit; i++) {
      const username = payload.useRandom
        ? randomUsername(payload.prefix)
        : `${payload.prefix}${String(i + 1).padStart(3, "0")}`;
      const address = `${username}@${payload.domain}`;
      if (mockMailboxes.some((m) => m.address === address)) {
        skipped.push(address);
        continue;
      }
      const mailbox: Mailbox = {
        id: `mbx-bulk-${Date.now()}-${i}`,
        address,
        username,
        domain: payload.domain,
        customerId: null,
        customerName: null,
        customerEmail: null,
        status: "unassigned",
        ownershipStatus: "unassigned",
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        messageCount: 0,
        storageUsed: 0,
        storageLimit: 100_000_000,
      };
      created.push(mailbox);
      mockMailboxes.unshift(mailbox);
    }

    return {
      created,
      skipped,
      progress: 100,
    };
  },

  async updateMailbox(
    id: string,
    patch: Partial<Mailbox> & { customerId?: string | null }
  ): Promise<Mailbox> {
    await delay(LATENCY);
    const index = mockMailboxes.findIndex((m) => m.id === id);
    if (index === -1) throw new Error("Mailbox not found");

    if (patch.customerId !== undefined) {
      const customer = patch.customerId
        ? mockCustomers.find((c) => c.id === patch.customerId)
        : null;
      mockMailboxes[index] = {
        ...mockMailboxes[index],
        customerId: customer?.id ?? null,
        customerName: customer?.displayName ?? null,
        customerEmail: customer?.email ?? null,
        ownershipStatus: customer ? "invitation_pending" : "unassigned",
        status: customer ? "pending_invite" : "unassigned",
      };
    }

    mockMailboxes[index] = { ...mockMailboxes[index], ...patch, id };
    return { ...mockMailboxes[index] };
  },

  async deleteMailbox(id: string): Promise<void> {
    await delay(LATENCY);
    const index = mockMailboxes.findIndex((m) => m.id === id);
    if (index === -1) throw new Error("Mailbox not found");
    const address = mockMailboxes[index].address;
    mockMailboxes.splice(index, 1);
    mockAuditLogs.unshift({
      id: `log-${Date.now()}`,
      action: "mailbox_deleted",
      actor: "admin@yoyknowmail.com",
      actorRole: "admin",
      target: address,
      metadata: {},
      ip: "192.0.2.10",
      createdAt: new Date().toISOString(),
      success: true,
    });
  },

  async getAdminCustomers(params: {
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<PaginatedResponse<CustomerAccount>> {
    await delay(LATENCY);
    let items = [...mockCustomers];
    if (params.search?.trim()) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          c.displayName.toLowerCase().includes(q)
      );
    }
    return paginate(items, params.page, params.pageSize);
  },

  async updateCustomerStatus(
    id: string,
    status: "active" | "suspended"
  ): Promise<CustomerAccount> {
    await delay(LATENCY);
    const customer = mockCustomers.find((c) => c.id === id);
    if (!customer) throw new Error("Customer not found");
    customer.status = status;
    mockAuditLogs.unshift({
      id: `log-${Date.now()}`,
      action: status === "suspended" ? "customer_suspended" : "customer_reactivated",
      actor: "admin@yoyknowmail.com",
      actorRole: "admin",
      target: customer.email,
      metadata: {},
      ip: "192.0.2.10",
      createdAt: new Date().toISOString(),
      success: true,
    });
    return { ...customer };
  },

  async getAuditLogs(params: {
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<PaginatedResponse<(typeof mockAuditLogs)[number]>> {
    await delay(LATENCY);
    let items = [...mockAuditLogs];
    if (params.search?.trim()) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (l) =>
          l.action.includes(q) ||
          l.actor.toLowerCase().includes(q) ||
          (l.target?.toLowerCase().includes(q) ?? false)
      );
    }
    return paginate(items, params.page, params.pageSize ?? 25);
  },

  async createInvitation(mailboxId: string, customerEmail: string): Promise<Invitation> {
    await delay(LATENCY);
    const mailbox = mockMailboxes.find((m) => m.id === mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");
    const invitation: Invitation = {
      id: `inv-${Date.now()}`,
      token: `invite-${Math.random().toString(36).slice(2, 10)}`,
      mailboxId,
      mailboxAddress: mailbox.address,
      customerEmail,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      acceptedAt: null,
    };
    mockInvitations.unshift(invitation);
    mailbox.ownershipStatus = "invitation_pending";
    mailbox.status = "pending_invite";
    mailbox.customerEmail = customerEmail;
    mockAuditLogs.unshift({
      id: `log-${Date.now()}`,
      action: "invitation_created",
      actor: "admin@yoyknowmail.com",
      actorRole: "admin",
      target: mailbox.address,
      metadata: { customer: customerEmail },
      ip: "192.0.2.10",
      createdAt: new Date().toISOString(),
      success: true,
    });
    return invitation;
  },

  async getInvitation(token: string): Promise<Invitation> {
    await delay(LATENCY);
    const invitation = mockInvitations.find((i) => i.token === token);
    if (!invitation) throw new Error("Invitation not found");
    if (invitation.status !== "pending") {
      throw new Error("This invitation is no longer valid");
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = "expired";
      throw new Error("This invitation has expired");
    }
    return { ...invitation };
  },

  async acceptInvitation(
    token: string,
    password: string
  ): Promise<{ requires2FASetup: true }> {
    void password;
    await delay(LATENCY);
    const invitation = mockInvitations.find((i) => i.token === token);
    if (!invitation || invitation.status !== "pending") {
      throw new Error("This invitation is no longer valid");
    }
    invitation.status = "accepted";
    invitation.acceptedAt = new Date().toISOString();
    const mailbox = mockMailboxes.find((m) => m.id === invitation.mailboxId);
    if (mailbox) {
      mailbox.ownershipStatus = "owned";
      mailbox.status = "active";
    }
    mockAuditLogs.unshift({
      id: `log-${Date.now()}`,
      action: "invitation_accepted",
      actor: invitation.customerEmail,
      actorRole: "customer",
      target: invitation.mailboxAddress,
      metadata: {},
      ip: null,
      createdAt: new Date().toISOString(),
      success: true,
    });
    return { requires2FASetup: true };
  },

  generateUsername(prefix = "user"): string {
    return randomUsername(prefix);
  },
};
