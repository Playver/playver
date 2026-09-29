"use client";

// Plain sign-out button, redirects to /auth/signin after.
import { useSignOut } from "@/lib/use-sign-out";

export default function SignOutButton({ label }: { label: string }) {
  const handleSignOut = useSignOut();

  return (
    <button
      onClick={handleSignOut}
      className="px-4 py-2 text-sm font-semibold text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors"
    >
      {label}
    </button>
  );
}
