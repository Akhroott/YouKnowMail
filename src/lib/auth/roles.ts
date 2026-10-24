import type { UserRole } from "@/lib/types";

export function isStaffRole(role?: string | null): boolean {
  return role === "admin" || role === "owner";
}

export function isOwnerRole(role?: string | null): boolean {
  return role === "owner";
}

export function homePathForRole(role?: UserRole | string | null): string {
  return isStaffRole(role) ? "/admin" : "/inbox";
}
