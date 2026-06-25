import { AdminSidebar } from "@/components/admin/admin-sidebar";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 overflow-auto bg-zinc-50/80 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
