"use server";

import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const RegisterInput = z.object({
  email: z.string().email().max(254),
  name: z.string().min(1).max(80),
});

export async function sendMagicLink(formData: FormData) {
  const parsed = RegisterInput.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
  });
  if (!parsed.success) {
    redirect(
      "/join?error=" +
        encodeURIComponent(parsed.error.errors[0]?.message ?? "Invalid input")
    );
  }
  const { email, name } = parsed.data;

  const authorEmail = process.env.AUTHOR_EMAIL?.toLowerCase().trim();
  const isAuthor = !!authorEmail && authorEmail === email.toLowerCase();

  // Pre-create the user with the chosen pen name so the magic-link callback
  // doesn't ignore it. If they already exist, update their name only if they
  // hadn't set one yet, and ensure the AUTHOR_EMAIL row has the 'author' role.
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!existing) {
    const { id } = await import("@/lib/ids");
    await db.insert(schema.users).values({
      id: id(),
      email,
      name,
      role: isAuthor ? "author" : "reader",
    });
  } else {
    const patch: { name?: string; role?: "author" | "reader" } = {};
    if (!existing.name) patch.name = name;
    if (isAuthor && existing.role !== "author") patch.role = "author";
    if (Object.keys(patch).length > 0) {
      await db
        .update(schema.users)
        .set(patch)
        .where(eq(schema.users.id, existing.id));
    }
  }

  await signIn("email", {
    email,
    redirectTo: "/play",
  });
}
