import Link from "next/link";
import { Stage } from "@/components/Stage";
import { requireStaff } from "@/lib/staff-auth";
import { logStaffAction } from "@/lib/staff-audit";
import { sendBatch, type EmailMessage } from "@/lib/email-provider";
import { db, schema } from "@/db";
import { isNotNull, eq, sql } from "drizzle-orm";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type AudienceMode = "all" | "still-in" | "eliminated";

async function sendAction(formData: FormData) {
  "use server";
  const me = await requireStaff({
    next: "/staff/announce",
    permission: "emails:write",
  });
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 140);
  const body = String(formData.get("body") ?? "").slice(0, 8000);
  const audience = String(formData.get("audience") ?? "all") as AudienceMode;
  const confirm = String(formData.get("confirm") ?? "");
  if (!subject || !body || confirm !== "yes") {
    await logStaffAction({
      actor: { id: me.id, email: me.email },
      action: "announce.aborted",
      details: { reason: "missing-fields" },
    });
    revalidatePath("/staff/announce");
    return;
  }

  // Resolve audience.
  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());
  let recipients: Array<{ email: string; userId: string; name: string | null }> =
    [];
  if (!t) {
    // No tournament — fall back to all verified users.
    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.users)
      .where(isNotNull(schema.users.email));
    recipients = rows
      .filter((r) => !!r.email)
      .map((r) => ({
        email: r.email as string,
        userId: r.id,
        name: r.name ?? null,
      }));
  } else {
    // Pull enrollments + users for this tournament.
    const rows = await db
      .select({
        userId: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        eliminatedAt: schema.enrollments.eliminatedAt,
      })
      .from(schema.enrollments)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.enrollments.userId)
      )
      .where(eq(schema.enrollments.tournamentId, t.id));
    recipients = rows
      .filter((r) => !!r.email)
      .filter((r) => {
        if (audience === "all") return true;
        if (audience === "still-in") return !r.eliminatedAt;
        return !!r.eliminatedAt;
      })
      .map((r) => ({
        email: r.email as string,
        userId: r.userId,
        name: r.name ?? null,
      }));
  }

  const fromAddr =
    process.env.EMAIL_FROM ??
    process.env.RESEND_FROM ??
    process.env.BREVO_FROM ??
    "no-reply@miaswebsites.art";
  const html = body
    .split("\n\n")
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  const messages: EmailMessage[] = recipients.map((r) => ({
    from: fromAddr,
    to: r.email,
    subject,
    html,
    text: body,
    templateId: "staff-announce",
  }));

  const result = await sendBatch(messages);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "announce.sent",
    target: subject.slice(0, 60),
    details: {
      audience,
      attempted: messages.length,
      sent: result.sent,
      errors: result.errors.length,
    },
  });
  revalidatePath("/staff/announce");
  revalidatePath("/staff/emails");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default async function StaffAnnouncePage() {
  await requireStaff({
    next: "/staff/announce",
    permission: "emails:write",
  });

  // Counts so the sender knows what they're firing at.
  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());
  const counts = { all: 0, stillIn: 0, eliminated: 0 };
  if (t) {
    const rows = await db
      .select({
        eliminatedAt: schema.enrollments.eliminatedAt,
      })
      .from(schema.enrollments)
      .where(eq(schema.enrollments.tournamentId, t.id));
    counts.all = rows.length;
    counts.stillIn = rows.filter((r) => !r.eliminatedAt).length;
    counts.eliminated = rows.filter((r) => !!r.eliminatedAt).length;
  } else {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(isNotNull(schema.users.email));
    counts.all = row?.c ?? 0;
  }

  return (
    <Stage scrollable>
      <div className="max-w-2xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">
            ✉️ Send announcement
          </h1>
          <Link href="/staff/emails" className="pop pop-white text-sm">
            ← Email log
          </Link>
        </div>
        <form action={sendAction} className="card px-5 py-5 flex flex-col gap-3">
          <label className="font-display text-sm text-navy">
            Subject
            <input
              name="subject"
              required
              maxLength={140}
              className="card-sm px-3 py-2 w-full mt-1 text-base font-body"
              placeholder="Subject line"
            />
          </label>
          <label className="font-display text-sm text-navy">
            Audience
            <select
              name="audience"
              className="card-sm px-3 py-2 w-full mt-1 text-base font-body"
              defaultValue="still-in"
            >
              <option value="all">Everyone enrolled ({counts.all})</option>
              <option value="still-in">
                Still in ({counts.stillIn})
              </option>
              <option value="eliminated">
                Eliminated ({counts.eliminated})
              </option>
            </select>
          </label>
          <label className="font-display text-sm text-navy">
            Body (plain text — paragraphs separated by blank lines)
            <textarea
              name="body"
              required
              maxLength={8000}
              rows={10}
              className="card-sm px-3 py-2 w-full mt-1 text-base font-body"
            />
          </label>
          <label className="flex items-center gap-2 font-body text-sm text-navy">
            <input type="checkbox" name="confirm" value="yes" required />
            Yes — actually send this email blast.
          </label>
          <button className="pop pop-coral text-base self-start">
            🚀 Send
          </button>
          <p className="font-body text-xs text-navy-soft">
            Sending is logged in the audit trail. Templates and richer
            audience filters live on the apex /host page.
          </p>
        </form>
      </div>
    </Stage>
  );
}
