import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-[var(--color-bg)]">
      <div className="w-full max-w-md">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-4xl mb-8">
          Admin Login
        </h1>
        <Suspense>
          <LoginForm next={next ?? "/admin"} />
        </Suspense>
      </div>
    </main>
  );
}
