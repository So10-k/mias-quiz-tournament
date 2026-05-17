// Plugin POSTs here when @support_bot changestatus runs in a
// Support Tickets topic, so the local support_tickets row stays in
// sync with Discourse.
//
// Side effect: when the submitter is a signed-in user we ALSO mirror
// the status change to Intercom — drops a contact-sidebar note and
// re-tags the contact (`support-open` / `support-pending` /
// `support-resolved` / `support-closed`). This is one-way today;
// future work: when an Intercom conversation gets the "→forum" tag,
// auto-open a Discourse topic.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import {
  findContactByExternalId,
  postContactNote,
  tagContact,
  intercomApiReady,
} from "@/lib/intercom-api";

const STATUS_TAG: Record<string, string> = {
  open: "support-open",
  pending: "support-pending",
  resolved: "support-resolved",
  closed: "support-closed",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set(["open", "pending", "resolved", "closed"]);

function verifyHmac(rawBody: string, signature: string): boolean {
  const secret = process.env.DISCOURSE_SSO_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-quizbook-signature") ?? "";
  if (!verifyHmac(raw, sig)) {
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 }
    );
  }
  let body: { topic_id?: number; status?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 }
    );
  }
  const topicId = Number(body.topic_id);
  const status = String(body.status ?? "").toLowerCase();
  if (!Number.isFinite(topicId) || topicId <= 0 || !VALID.has(status)) {
    return NextResponse.json(
      { ok: false, error: "invalid payload" },
      { status: 400 }
    );
  }
  const result = await db
    .update(schema.supportTickets)
    .set({
      status: status as "open" | "pending" | "resolved" | "closed",
      updatedAt: new Date(),
    })
    .where(eq(schema.supportTickets.discourseTopicId, topicId))
    .returning({
      id: schema.supportTickets.id,
      subject: schema.supportTickets.subject,
      submitterUserId: schema.supportTickets.submitterUserId,
    });

  // ── Mirror to Intercom (best-effort, never blocks the response).
  //    Only when the submitter is a signed-in user (we need a userId
  //    to map to their Intercom contact via external_id).
  if (result.length && result[0].submitterUserId && intercomApiReady()) {
    void mirrorToIntercom({
      userId: result[0].submitterUserId,
      subject: result[0].subject,
      status,
      topicId,
    });
  }

  return NextResponse.json({
    ok: true,
    updated: result.length,
  });
}

async function mirrorToIntercom(args: {
  userId: string;
  subject: string;
  status: string;
  topicId: number;
}) {
  try {
    const contact = await findContactByExternalId(args.userId);
    if (!contact) return; // user hasn't started an Intercom session yet
    const base =
      process.env.DISCOURSE_BASE_URL ?? "https://discuss.miaswebsites.art";
    const url = `${base}/t/${args.topicId}`;
    await postContactNote({
      contactId: contact.id,
      body:
        `Forum support ticket status → <b>${args.status.toUpperCase()}</b><br>` +
        `Subject: ${escapeHtml(args.subject)}<br>` +
        `<a href="${url}">${url}</a>`,
    });
    const tagName = STATUS_TAG[args.status];
    if (tagName) await tagContact({ contactId: contact.id, tagName });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("intercom sync (status):", err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
