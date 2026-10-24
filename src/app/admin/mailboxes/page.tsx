import { redirect } from "next/navigation";

export default function LegacyMailboxesRedirect() {
  redirect("/admin/accounts");
}
