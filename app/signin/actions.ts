"use server";

import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const Input = z.object({ email: z.string().email().max(254) });

export async function signInAction(formData: FormData) {
  const parsed = Input.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) {
    redirect("/signin?error=Enter+a+valid+email");
  }
  const email = parsed.data.email;

  const [u] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!u) {
    // No account yet → bounce to /join with the email pre-filled so they
    // only need to add a name.
    redirect(
      `/join?email=${encodeURIComponent(email)}&newHere=1`
    );
  }

  await signIn("email", { email, redirectTo: "/play" });
}
