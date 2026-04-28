import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--color-bg)]">
      <AdminNav />
      <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8 max-w-full md:max-w-7xl overflow-x-auto">{children}</main>
    </div>
  );
}
