"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Tiny form that POSTs the typed password to the unlock route, then
// reloads the viewer page on success.
export function PasswordGate({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await fetch(`/api/files/${fileId}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(
          d.error === "wrong_password"
            ? "That doesn't match. Try again?"
            : "Couldn't unlock. Try again?"
        );
      }
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't unlock");
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="card px-7 py-7 max-w-md mx-auto flex flex-col gap-3">
      <div className="text-5xl text-center">🔑</div>
      <h2 className="font-display text-2xl text-navy text-center">
        This file is password-protected
      </h2>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        placeholder="Password"
      />
      {error ? (
        <p className="font-body text-sm text-coral-deep">⚠️ {error}</p>
      ) : null}
      <button type="submit" className="pop pop-coral" disabled={pending || !password}>
        {pending ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}
