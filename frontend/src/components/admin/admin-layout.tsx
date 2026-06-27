import { AdminSidebar } from "@/components/admin/admin-sidebar";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div
      data-admin-portal
      className="flex min-h-screen bg-[var(--admin-bg)] text-[var(--admin-foreground)]"
    >
      <AdminSidebar />
      <main className="flex min-h-screen min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
