import type { ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Middleware handles auth protection. This layout is only rendered after auth succeeds
  return <AdminShell>{children}</AdminShell>;
}
