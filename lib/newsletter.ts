// Newsletter subscription helpers. Wraps the
// `newsletter_subscriptions` table with idempotent upsert semantics
// (re-subscribing keeps the same row + tokens) and double-opt-in
// confirmation.
//
// Tokens are 32-char base36 random strings. Generated server-side and
// embedded in confirm/unsubscribe URLs that get emailed out.

import { db, schema } from "@/db";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";

const { newsletterSubscriptions } = schema;

export type SubscriptionFrequency = "daily" | "weekly" | "monthly";
export type Subscription =
  typeof newsletterSubscriptions.$inferSelect;

function token(len = 32): string {
  // Concatenate enough randomness to fill `len` characters of base36.
  const out: string[] = [];
  while (out.join("").length < len) {
    out.push(Math.random().toString(36).slice(2));
  }
  return out.join("").slice(0, len);
}

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export async function subscribe(args: {
  email: string;
  userId?: string | null;
  frequency: SubscriptionFrequency;
}): Promise<{ subscription: Subscription; isNew: boolean }> {
  const email = normalizeEmail(args.email);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("invalid email");
  }
  const [existing] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.email, email))
    .limit(1);
  if (existing) {
    // Re-subscribe / change frequency. Re-arm unsubscribe + bump
    // confirmation token so the previously-emailed link is invalidated.
    const [updated] = await db
      .update(newsletterSubscriptions)
      .set({
        frequency: args.frequency,
        userId: args.userId ?? existing.userId,
        unsubscribedAt: null,
        // If never confirmed, hand them a fresh token (in case the
        // previous email was lost).
        confirmationToken: existing.confirmedAt
          ? existing.confirmationToken
          : token(),
      })
      .where(eq(newsletterSubscriptions.id, existing.id))
      .returning();
    return { subscription: updated, isNew: false };
  }
  const [created] = await db
    .insert(newsletterSubscriptions)
    .values({
      id: makeId(),
      email,
      userId: args.userId ?? null,
      frequency: args.frequency,
      confirmationToken: token(),
      unsubscribeToken: token(),
    })
    .returning();
  return { subscription: created, isNew: true };
}

export async function confirmByToken(
  confirmationToken: string
): Promise<Subscription | null> {
  const [row] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.confirmationToken, confirmationToken))
    .limit(1);
  if (!row) return null;
  if (row.confirmedAt) return row;
  const [updated] = await db
    .update(newsletterSubscriptions)
    .set({ confirmedAt: new Date(), unsubscribedAt: null })
    .where(eq(newsletterSubscriptions.id, row.id))
    .returning();
  return updated;
}

export async function unsubscribeByToken(
  unsubscribeToken: string
): Promise<Subscription | null> {
  const [row] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.unsubscribeToken, unsubscribeToken))
    .limit(1);
  if (!row) return null;
  const [updated] = await db
    .update(newsletterSubscriptions)
    .set({ unsubscribedAt: new Date() })
    .where(eq(newsletterSubscriptions.id, row.id))
    .returning();
  return updated;
}

export async function getActiveSubscriptions(opts?: {
  frequency?: SubscriptionFrequency;
}): Promise<Subscription[]> {
  const conds = [
    isNotNull(newsletterSubscriptions.confirmedAt),
    isNull(newsletterSubscriptions.unsubscribedAt),
  ];
  if (opts?.frequency) {
    conds.push(eq(newsletterSubscriptions.frequency, opts.frequency));
  }
  return db
    .select()
    .from(newsletterSubscriptions)
    .where(and(...conds))
    .orderBy(asc(newsletterSubscriptions.createdAt));
}

export async function markSent(ids: string[]) {
  if (ids.length === 0) return;
  // Drizzle's `inArray` would be cleaner; we go raw to keep imports
  // stable across older drizzle versions.
  await db
    .update(newsletterSubscriptions)
    .set({ lastSentAt: new Date() })
    .where(sql`${newsletterSubscriptions.id} = ANY(${ids})`);
}

export function publicBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? "https://quiz.miaswebsites.art";
}

export function confirmUrl(t: string): string {
  return `${publicBaseUrl()}/blog/confirm/${encodeURIComponent(t)}`;
}
export function unsubscribeUrl(t: string): string {
  return `${publicBaseUrl()}/blog/unsubscribe/${encodeURIComponent(t)}`;
}
