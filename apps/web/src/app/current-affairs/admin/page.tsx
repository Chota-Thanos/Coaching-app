import { redirect } from "next/navigation";

export default function OldAdminRootRedirect() {
  redirect("/admin/current-affairs/overview");
}
