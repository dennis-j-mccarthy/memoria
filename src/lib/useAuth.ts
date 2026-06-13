"use client";

import { useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Reads the current session from /api/auth/me. Returns the user (or null when
 * signed out) and a loading flag. A full navigation after login/logout re-runs
 * this, so there's no shared store to keep in sync.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (active) setUser((d?.user as AuthUser | null) ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { user, loading };
}
