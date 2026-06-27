import { AdminPageShell } from "@/components/admin/shell/admin-page-shell";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

/** @deprecated Use AdminPageShell directly */
export function AdminPageHeader({
  title,
  description,
  actions,
  children,
}: AdminPageHeaderProps) {
  return (
    <AdminPageShell title={title} description={description} actions={actions}>
      {children}
    </AdminPageShell>
  );
}
