import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthStatus } from "@/components/AuthStatus";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-parchment/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
        <Link
          href="/"
          className="font-serif text-2xl tracking-tight text-ink"
          style={{ letterSpacing: "0.01em" }}
        >
          Memoria
        </Link>
        <div className="flex items-center gap-4">
          <AuthStatus />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
