import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { getStaffUser } from "@/lib/staff-auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function MiamailMessage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await currentUser();
  const staff = await getStaffUser();
  if (!me && !staff) redirect("/signin");

  const [msg] = await db
    .select()
    .from(schema.emailSends)
    .where(eq(schema.emailSends.id, id))
    .limit(1);
  if (!msg) notFound();

  // Authorization: recipient (by id or email), author, or any staff member.
  const isRecipient =
    !!me &&
    (msg.recipientUserId === me.id ||
      msg.recipientEmail.toLowerCase() === (me.email ?? "").toLowerCase());
  const isAuthor = me?.role === "author";
  if (!isRecipient && !isAuthor && !staff) notFound();

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <Link href="/miamail" className="font-display text-base text-navy">
            ← Miamail
          </Link>
          <span className="font-body text-xs text-navy-soft">
            {new Date(msg.sentAt).toLocaleString()}
          </span>
        </div>
        <div className="card-sm bg-white px-5 py-3">
          <p className="font-display text-2xl text-navy">{msg.subject}</p>
          <p className="font-body text-xs text-navy-soft mt-1">
            to {msg.recipientEmail} · via {msg.provider}
            {msg.templateId ? ` · template: ${msg.templateId}` : ""}
          </p>
        </div>
        <div className="card px-2 py-2 overflow-hidden">
          <iframe
            title={msg.subject}
            srcDoc={msg.htmlBody}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            style={{
              width: "100%",
              height: "70vh",
              border: 0,
              borderRadius: 12,
              background: "white",
            }}
          />
        </div>
      </div>
    </Stage>
  );
}
