import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthForm } from "@/components/AuthForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  // Only allow same-origin relative paths as the post-login destination.
  const safeRedirect =
    redirect && redirect.startsWith("/") && !redirect.startsWith("//")
      ? redirect
      : "/";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-24">
        <div className="py-6">
          <Link
            href="/"
            className="font-sans text-sm text-ink-faint transition-colors hover:text-gold"
          >
            ← All prayers
          </Link>
        </div>

        <header className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">
            Sign in to Memoria
          </h1>
          <p className="mt-3 font-sans text-sm text-ink-soft">
            Save your anchors and carry them across devices.
          </p>
        </header>

        <AuthForm redirect={safeRedirect} />
      </main>
    </>
  );
}
