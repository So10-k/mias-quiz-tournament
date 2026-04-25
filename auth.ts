import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/db/schema";
import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "Mia's Quiz Tournament <onboarding@resend.dev>";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
    verifyRequest: "/join/check-inbox",
  },
  providers: [
    {
      id: "email",
      type: "email",
      name: "Email",
      from: FROM,
      maxAge: 24 * 60 * 60, // 24 hours
      // Generate a 32-char token rather than NextAuth's default uuid for slightly cleaner links.
      generateVerificationToken: async () => {
        const bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      },
      sendVerificationRequest: async ({
        identifier,
        url,
      }: {
        identifier: string;
        url: string;
      }) => {
        const subject = "Your magic link";
        const text = magicLinkText(url);
        const html = magicLinkHtml(url);

        if (!RESEND_API_KEY) {
          // Dev fallback — print the link so you can sign in without email.
          // eslint-disable-next-line no-console
          console.log(
            `\n  ✦ Magic link for ${identifier}\n  ✦ ${url}\n  ✦ (Set RESEND_API_KEY in .env.local to send real email.)\n`
          );
          return;
        }
        const resend = new Resend(RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: FROM,
          to: identifier,
          subject,
          text,
          html,
        });
        if (error) {
          throw new Error(
            `Resend failed to send magic link: ${error.message ?? String(error)}`
          );
        }
      },
    } as any,
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
        (session.user as any).role = (user as any).role;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Promote the configured author email to author role on first sign-in.
      const author = process.env.AUTHOR_EMAIL?.toLowerCase().trim();
      if (author && user.email?.toLowerCase() === author) {
        const { db } = await import("@/db");
        const { users: usersTable } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        await db
          .update(usersTable)
          .set({ role: "author" })
          .where(eq(usersTable.id, user.id!));
      }
    },
  },
});

function magicLinkText(url: string) {
  return [
    "Welcome! Tap the link below to play. It works once, within 24 hours.",
    "",
    url,
    "",
    "If you didn't ask for this, you can ignore it.",
    "",
    "— Mia's Quiz Tournament",
  ].join("\n");
}

function magicLinkHtml(url: string) {
  return `<!doctype html>
<html><body style="background:#87CEEB;margin:0;padding:32px;font-family:Quicksand,sans-serif;color:#1B2A4E">
  <div style="max-width:520px;margin:0 auto;background:white;padding:32px;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E">
    <p style="font-family:Fredoka,sans-serif;font-size:28px;font-weight:700;line-height:1.2;margin:0 0 16px">🌞 Welcome!</p>
    <p style="font-size:18px;line-height:1.55;margin:0 0 24px">Tap the button below to start playing. It works once, within 24 hours.</p>
    <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;padding:12px 24px;background:#FF6B9D;color:white;text-decoration:none;font-family:Fredoka,sans-serif;font-weight:600;font-size:18px;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E">Play now →</a></p>
    <p style="font-size:14px;line-height:1.5;color:#3B4A7E;margin:24px 0 0">If the button doesn't work, paste this URL: ${url}</p>
    <p style="font-size:14px;line-height:1.5;color:#3B4A7E;margin:16px 0 0">— Mia&rsquo;s Quiz Tournament</p>
  </div>
</body></html>`;
}
