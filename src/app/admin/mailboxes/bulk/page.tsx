import { redirect } from "next/navigation";

export default function LegacyBulkMailboxesRedirect() {
  redirect("/admin/accounts/bulk");
}
