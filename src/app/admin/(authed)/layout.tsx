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
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      <AdminNav />
      <main className="flex-1 px-8 py-8 max-w-7xl">{children}</main>
    </div>
  );
}
