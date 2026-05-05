import NextAuth from "next-auth";
import Auth0 from "next-auth/providers/auth0";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/db/schema";
import { sendOne } from "@/lib/email-provider";

const FROM = process.env.EMAIL_FROM || "Mia's Quiz Tournament <onboarding@resend.dev>";

// Auth0 is enabled when both ID + secret are present in env. We keep the
// existing email/magic-link provider running in parallel so existing users
// don't lose their flow during the migration; once everyone has signed in
// via Auth0 at least once, the email provider can be removed.
const auth0Enabled =
  !!process.env.AUTH_AUTH0_ID &&
  !!process.env.AUTH_AUTH0_SECRET &&
  !!process.env.AUTH_AUTH0_ISSUER;

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
        const result = await sendOne({
          from: FROM,
          to: identifier,
          subject: "Your magic link",
          text: magicLinkText(url),
          html: magicLinkHtml(url),
        });
        if (result.dryRun) {
          // eslint-disable-next-line no-console
          console.log(
            `\n  ✦ Magic link for ${identifier}\n  ✦ ${url}\n  ✦ (Set RESEND_API_KEY or BREVO_API_KEY to send real email.)\n`
          );
          return;
        }
        if (result.errors.length > 0) {
          throw new Error(
            `Email provider (${result.provider}) failed to send magic link: ${result.errors[0]}`
          );
        }
      },
    } as any,
    ...(auth0Enabled
      ? [
          Auth0({
            clientId: process.env.AUTH_AUTH0_ID,
            clientSecret: process.env.AUTH_AUTH0_SECRET,
            issuer: process.env.AUTH_AUTH0_ISSUER,
            // Link by verified email so existing users keep their `users.id`
            // (and every FK that depends on it: enrollments, attempts,
            // predictions, email_sends, files, …). Auth0's passwordless-email
            // connection only issues tokens after the user clicks a link sent
            // to that address, so the email is verified end-to-end. Auth.js
            // calls this "dangerous" because it would let any IdP that
            // claims an email take over the account; for our trusted
            // Auth0 tenant the flag is the right call. Reconsider before
            // adding any IdP that lets users self-attest emails.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    // Gate first-time sign-ins behind the tournament's registration toggle.
    // Without this, Auth0's passwordless flow auto-creates a `users` row
    // for any verified email — bypassing the "registration closed" rule
    // that the legacy /signin/actions form enforces by bouncing unknown
    // emails to /join. Existing users (any row in `users` with that email)
    // sail through; brand-new emails get rejected when registration is off.
    //
    // Returning `false` from signIn aborts the flow; Auth.js redirects to
    // /signin?error=AccessDenied which the page surfaces as a friendly
    // "registration is closed" message.
    async signIn({ user, account }) {
      // Only gate OAuth/OIDC providers (Auth0). The email/magic-link
      // provider's own action layer already enforces this rule.
      if (account?.type !== "oauth" && account?.type !== "oidc") return true;
      const email = user.email?.toLowerCase().trim();
      if (!email) return false;

      const { db } = await import("@/db");
      const { users: usersTable, tournaments } = await import("@/db/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      if (existing) return true;

      // No existing user — would create. Check the latest tournament's
      // registration state. We use the most recently created tournament
      // because there's typically only one active at a time.
      const [latest] = await db
        .select({
          registrationOpen: tournaments.registrationOpen,
        })
        .from(tournaments)
        .orderBy(desc(tournaments.createdAt))
        .limit(1);
      // No tournament yet → allow (this is the first user setting things up).
      if (!latest) return true;
      return latest.registrationOpen === true;
    },
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
