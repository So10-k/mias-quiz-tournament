"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import {
  createSupportTicket,
  getTicketByTopicId,
  replyToTicketAsSubmitter,
} from "@/lib/support-tickets";

const Input = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120),
  subject: z.string().trim().min(3).max(140),
  message: z.string().trim().min(10).max(4000),
  topic: z.string().trim().max(40).optional(),
});

export async function submitSupportTicket(formData: FormData) {
  const parsed = Input.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    message: String(formData.get("message") ?? ""),
    topic: String(formData.get("topic") ?? "") || undefined,
  });
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid input";
    redirect(`/support?err=${encodeURIComponent(msg)}`);
  }

  const me = await currentUser();
  const result = await createSupportTicket({
    ...parsed.data,
    submitterUserId: me?.id ?? null,
  });

  if (!result.ok) {
    redirect(
      `/support?err=${encodeURIComponent(
        "Couldn't reach the support inbox. " + result.error
      )}`
    );
  }
  redirect("/support?ok=1");
}

const ReplyInput = z.object({
  topicId: z.coerce.number().int().positive(),
  message: z.string().trim().min(2).max(4000),
});

export async function replyToTicketAction(formData: FormData) {
  const parsed = ReplyInput.safeParse({
    topicId: formData.get("topicId"),
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) {
    redirect(
      `/support?err=${encodeURIComponent(
        parsed.error.errors[0]?.message ?? "Invalid input"
      )}`
    );
  }

  const { topicId, message } = parsed.data;
  const ticket = await getTicketByTopicId(topicId);
  if (!ticket) {
    redirect(`/support?err=${encodeURIComponent("Ticket not found")}`);
  }

  // Authorization: only the original submitter (matched by user id
  // OR email) or an author can reply on the portal.
  const me = await currentUser();
  const isAuthor = me?.role === "author";
  const isSubmitter =
    !!me &&
    (ticket.submitterUserId === me.id ||
      (me.email &&
        ticket.submitterEmail.toLowerCase() === me.email.toLowerCase()));
  if (!isAuthor && !isSubmitter) {
    redirect(
      `/support?err=${encodeURIComponent("You can't reply on this ticket")}`
    );
  }

  const result = await replyToTicketAsSubmitter({
    topicId,
    submitterName: me?.name ?? ticket.submitterName,
    submitterEmail: me?.email ?? ticket.submitterEmail,
    message,
  });
  if (!result.ok) {
    redirect(
      `/support/${topicId}?err=${encodeURIComponent(
        "Couldn't post reply: " + result.error
      )}`
    );
  }

  revalidatePath(`/support/${topicId}`);
  redirect(`/support/${topicId}`);
}
