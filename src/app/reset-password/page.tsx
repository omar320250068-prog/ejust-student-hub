import { redirect } from "next/navigation";

/** Alias for older bookmarks: the reset flow lives on /forgot-password. */
export default function ResetPasswordAliasPage() {
  redirect("/forgot-password");
}
