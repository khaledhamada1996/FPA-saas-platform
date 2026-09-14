import { redirect } from "next/navigation";

// Legacy dashboard namespace. The product now has one canonical workspace shell.
// Keeping the redirect preserves old bookmarks without maintaining a second UI/RBAC surface.
export default function DashboardLayout() {
  redirect("/workspace");
}
