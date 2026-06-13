"use client";

import { useState } from "react";

type Mode = "login" | "register";

/** Login / create-account form. On success, navigates to `redirect` (full load
 *  so server components and the header pick up the new session). */
export function AuthForm({ redirect = "/" }: { redirect?: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { email, password, name } : { email, password },
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        setBusy(false);
        return;
      }
      window.location.assign(redirect);
    } catch {
      setError("Network error — please try again");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      {/* Mode toggle */}
      <div
        className="mb-6 inline-flex w-full rounded-full border border-hairline bg-parchment-raised p-1"
        role="group"
        aria-label="Sign in or create an account"
      >
        {(["login", "register"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            aria-pressed={mode === m}
            className={`flex-1 rounded-full px-4 py-1.5 font-sans text-sm transition-colors ${
              mode === m
                ? "bg-ink text-parchment-raised"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && (
          <Field
            label="Name (optional)"
            type="text"
            value={name}
            onChange={setName}
            autoComplete="name"
          />
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          hint={mode === "register" ? "At least 8 characters" : undefined}
        />

        {error && (
          <p className="font-sans text-sm text-[#b3261e]" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-ink px-4 py-2.5 font-sans text-sm font-medium text-parchment-raised transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy
            ? "…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-sans text-sm text-ink-soft">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-xl border border-hairline bg-parchment-raised px-3 py-2 font-sans text-base text-ink outline-none transition-colors focus:border-gold/60"
      />
      {hint && (
        <span className="mt-1 block font-sans text-xs text-ink-faint">{hint}</span>
      )}
    </label>
  );
}
