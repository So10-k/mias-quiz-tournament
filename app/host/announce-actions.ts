"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Resend } from "resend";
import { requireUser } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, isNull, and, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
  return u;
}

const Audience = z.enum(["all", "still_in", "eliminated", "all_users"]);
type Audience = z.infer<typeof Audience>;

const Input = z.object({
  subject: z.string().min(1).max(140),
  body: z.string().min(1).max(8000),
  audience: Audience,
  confirm: z.literal("yes"),
});

export type AnnouncementResult = {
  ok: boolean;
  audience: Audience;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  errors: string[];
  dryRun: boolean;
};

async function gatherRecipients(audience: Audience) {
  // Collect every signed-up player on the active/latest tournament, OR every
  // user in the database for "all_users" (rarely needed but available).
  if (audience === "all_users") {
    const rows = await db
      .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
      .from(schema.users);
    return rows.filter((r) => !!r.email);
  }

  const tournament = (
    await db.select().from(schema.tournaments).orderBy(schema.tournaments.createdAt)
  )
    .reverse()[0];
  if (!tournament) return [];

  const baseConditions =
    audience === "still_in"
      ? and(
          eq(schema.enrollments.tournamentId, tournament.id),
          isNull(schema.enrollments.eliminatedAt)
        )
      : audience === "eliminated"
      ? and(
          eq(schema.enrollments.tournamentId, tournament.id),
          isNotNull(schema.enrollments.eliminatedAt)
        )
      : eq(schema.enrollments.tournamentId, tournament.id);

  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.enrollments)
    .innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
    .where(baseConditions);

  // Dedupe by email and skip empties.
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (!r.email) return false;
    const key = r.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function previewRecipients(
  audience: Audience
): Promise<{ count: number; emails: string[] }> {
  await requireHost();
  const list = await gatherRecipients(audience);
  return {
    count: list.length,
    emails: list.map((r) => r.email!).slice(0, 25),
  };
}

function plainToHtml(body: string): string {
  // Conservative: escape, preserve paragraph breaks, linkify URLs.
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const paragraphs = body
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="font-size:18px;line-height:1.55;margin:0 0 16px">${esc(p)
          .replace(/\n/g, "<br/>")
          .replace(
            /(https?:\/\/[^\s<]+)/g,
            (u) =>
              `<a href="${u}" style="color:#FF6B9D;text-decoration:underline">${u}</a>`
          )}</p>`
    )
    .join("");
  return `<!doctype html>
<html><body style="background:#87CEEB;margin:0;padding:32px;font-family:Quicksand,sans-serif;color:#1B2A4E">
  <div style="max-width:560px;margin:0 auto;background:white;padding:32px;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E">
    <p style="font-family:Fredoka,sans-serif;font-weight:700;font-size:22px;margin:0 0 16px">🌞 Mia&rsquo;s Quiz Tournament</p>
    ${paragraphs}
    <p style="font-size:13px;color:#3B4A7E;margin:24px 0 0">— Mia 🎮</p>
  </div>
</body></html>`;
}

export async function sendAnnouncement(
  formData: FormData
): Promise<AnnouncementResult> {
  await requireHost();

  const parsed = Input.safeParse({
    subject: String(formData.get("subject") ?? "").trim(),
    body: String(formData.get("body") ?? ""),
    audience: String(formData.get("audience") ?? "still_in"),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      audience: "still_in",
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      errors: [parsed.error.errors[0]?.message ?? "Invalid input"],
      dryRun: false,
    };
  }

  const { subject, body, audience } = parsed.data;
  const recipients = await gatherRecipients(audience);
  if (recipients.length === 0) {
    return {
      ok: false,
      audience,
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      errors: ["No recipients in that audience yet."],
      dryRun: false,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    "Mia's Quiz Tournament <onboarding@resend.dev>";
  const html = plainToHtml(body);
  const text = body;

  // Dev fallback: print, don't actually send.
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[DEV] Would send "${subject}" to ${recipients.length} recipient(s):`
    );
    for (const r of recipients) {
      // eslint-disable-next-line no-console
      console.log(`  - ${r.email}`);
    }
    revalidatePath("/host");
    return {
      ok: true,
      audience,
      recipientCount: recipients.length,
      sentCount: recipients.length,
      failedCount: 0,
      errors: [],
      dryRun: true,
    };
  }

  const resend = new Resend(apiKey);
  const errors: string[] = [];
  let sent = 0;

  // Batch up to 100 per Resend call.
  const CHUNK = 90;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const slice = recipients.slice(i, i + CHUNK);
    try {
      const { data, error } = await resend.batch.send(
        slice.map((r) => ({
          from,
          to: r.email!,
          subject,
          text,
          html,
        }))
      );
      if (error) {
        errors.push(error.message ?? String(error));
      } else if (data && Array.isArray((data as any).data)) {
        sent += (data as any).data.length;
      } else {
        sent += slice.length;
      }
    } catch (e: any) {
      errors.push(e?.message ?? String(e));
    }
  }

  revalidatePath("/host");
  return {
    ok: errors.length === 0,
    audience,
    recipientCount: recipients.length,
    sentCount: sent,
    failedCount: Math.max(0, recipients.length - sent),
    errors,
    dryRun: false,
  };
}
