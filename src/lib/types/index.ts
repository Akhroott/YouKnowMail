export type UserRole = "customer" | "admin" | "owner";
export type AccountStatus = "active" | "suspended" | "pending";
export type MailboxStatus = "active" | "suspended" | "unassigned" | "pending_invite";
export type MessageFolder = "inbox" | "starred" | "archive" | "trash";
export type ThemePreference = "light" | "dark" | "system";
export type InboxDensity = "comfortable" | "compact";
export type DateTimeFormat = "relative" | "absolute";
export type OwnershipStatus =
  | "unassigned"
  | "invitation_pending"
  | "owned"
  | "transfer_pending";

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  twoFactorEnabled: boolean;
  role: UserRole;
  mailboxId: string | null;
}

export interface Mailbox {
  id: string;
  address: string;
  username: string;
  domain: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  status: MailboxStatus;
  ownershipStatus: OwnershipStatus;
  createdAt: string;
  lastLoginAt: string | null;
  messageCount: number;
  storageUsed: number;
  storageLimit: number;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  size: number;
  contentType: string;
}

export interface Message {
  id: string;
  mailboxId: string;
  folder: MessageFolder;
  from: { name: string; address: string };
  to: { name: string; address: string };
  subject: string;
  preview: string;
  bodyText: string;
  bodyHtml: string;
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments: MessageAttachment[];
  detectedCode?: string | null;
}

export interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActiveAt: string;
  current: boolean;
}

export interface AccountPreferences {
  theme: ThemePreference;
  dateTimeFormat: DateTimeFormat;
  inboxDensity: InboxDensity;
  showImages: boolean;
  markReadOnOpen: boolean;
}

export interface CustomerAccount extends UserAccount {
  preferences: AccountPreferences;
  recoveryCodesRemaining: number;
  sessions: SessionInfo[];
}

export interface AdminStats {
  totalMailboxes: number;
  activeMailboxes: number;
  suspendedMailboxes: number;
  mailboxesCreatedToday: number;
  messagesToday: number;
  storageUsed: number;
  storageLimit: number;
  mailboxGrowth: { date: string; count: number }[];
  inboundVolume: { date: string; count: number }[];
  recentActivity: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actor: string;
  actorRole: UserRole | "system";
  target: string | null;
  metadata: Record<string, string>;
  ip: string | null;
  createdAt: string;
  success: boolean;
}

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "logout"
  | "mailbox_created"
  | "mailbox_suspended"
  | "mailbox_reactivated"
  | "mailbox_deleted"
  | "ownership_transfer"
  | "invitation_created"
  | "invitation_accepted"
  | "password_changed"
  | "2fa_enabled"
  | "2fa_disabled"
  | "session_revoked"
  | "customer_suspended"
  | "customer_reactivated"
  | "access_reset"
  | "account_created"
  | "accounts_bulk_created"
  | "account_password_set"
  | "account_role_changed"
  | "account_status_changed";

/** Item from GET /admin/accounts — safe fields only */
export interface AdminAccountListItem {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  mailboxId: string | null;
  mailboxAddress: string | null;
  /** True when an owner provisioned this customer — admins cannot manage it */
  ownerProtected?: boolean;
}

/** Response from POST /admin/accounts */
export interface CreatedUnifiedAccount {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  mailboxId: string;
  mailboxAddress: string;
}

export interface CreateUnifiedAccountRequest {
  username: string;
  password: string;
  displayName?: string;
}

export interface BulkCreateAccountsRequest {
  prefix: string;
  count: number;
  startIndex?: number;
  padWidth?: number;
  useRandom?: boolean;
  passwordMode: "shared" | "generate";
  password?: string;
  displayNamePrefix?: string;
}

export interface BulkCreatedAccount extends CreatedUnifiedAccount {
  /** Returned once for operator export — never stored client-side by default */
  password: string;
}

export interface BulkCreateAccountsResult {
  created: BulkCreatedAccount[];
  skipped: { username: string; reason: string }[];
  createdCount: number;
  skippedCount: number;
}

export interface SetAccountPasswordRequest {
  password: string;
}

/** Response from PATCH /admin/owners/{id}/role|status */
export interface OwnerManagedAccount {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
}

export interface Invitation {
  id: string;
  token: string;
  mailboxId: string;
  mailboxAddress: string;
  customerEmail: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  inviteUrl?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  requires2FA: boolean;
  tempToken?: string;
  user?: UserAccount;
}

export interface TwoFactorVerifyRequest {
  tempToken?: string;
  code: string;
  method?: "totp" | "recovery";
  /** When true, confirms authenticated 2FA setup (returns recoveryCodes). */
  setup?: boolean;
}

export interface MessageListParams {
  folder?: MessageFolder | "unread";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface MessageUpdate {
  isRead?: boolean;
  isStarred?: boolean;
  /** Backend accepts inbox | archive | trash only (not starred). */
  folder?: "inbox" | "archive" | "trash";
}

export interface ApiError {
  message: string;
  code?: string;
  field?: string;
}
