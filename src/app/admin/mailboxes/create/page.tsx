import { redirect } from "next/navigation";

export default function LegacyCreateMailboxRedirect() {
  redirect("/admin/accounts/create");
}
