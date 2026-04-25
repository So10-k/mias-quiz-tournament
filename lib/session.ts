import { auth } from "@/auth";

type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: "author" | "reader";
};

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as any;
  return {
    id: u.id,
    email: u.email ?? null,
    name: u.name ?? null,
    role: (u.role as "author" | "reader") ?? "reader",
  };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new Error("Unauthorized");
  return u;
}
