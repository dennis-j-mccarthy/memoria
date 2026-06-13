"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/useAuth";

/** Header auth control: Sign in link when signed out, email + Sign out when in. */
export function AuthStatus() {
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.reload();
  }

  if (loading) return <div className="h-6 w-16" aria-hidden />;

  if (!user) {
    return (
      <Link
        href="/signin"
        className="font-sans text-sm text-ink-soft transition-colors hover:text-gold"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="max-w-[14ch] truncate font-sans text-sm text-ink-faint"
        title={user.email}
      >
        {user.name || user.email}
      </span>
      <button
        onClick={signOut}
        disabled={signingOut}
        className="font-sans text-sm text-ink-soft transition-colors hover:text-gold disabled:opacity-50"
      >
        Sign out
      </button>
    </div>
  );
}
