"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { signUp } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignupForm() {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError("");
    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="displayName" className="text-sm font-medium text-[var(--text-secondary)]">
          Display name
        </label>
        <Input id="displayName" name="displayName" type="text" autoComplete="name" required placeholder="Your name" />
      </div>

      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium text-[var(--text-secondary)]">
          Username
        </label>
        <Input id="username" name="username" type="text" autoComplete="username" required placeholder="username" />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-[var(--text-secondary)]">
          Email
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-[var(--text-secondary)]">
          Password
        </label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="At least 8 characters" />
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Create account
      </Button>

      <div className="text-center text-sm text-[var(--text-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--accent)] hover:opacity-90">
          Log in
        </Link>
      </div>
    </form>
  );
}
