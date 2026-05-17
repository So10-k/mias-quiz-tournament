import type { Metadata } from "next";
import "./globals.css";
import { VisitLogger } from "@/components/VisitLogger";
import { IntercomBoot } from "@/components/IntercomBoot";
import { IntercomLauncher } from "@/components/IntercomLauncher";
import { IntercomTracker } from "@/components/IntercomTracker";
import { HideOnWatch } from "@/components/HideOnWatch";
import { SiteBanner } from "@/components/SiteBanner";
import { ld, organizationLD, websiteLD, SITE_URL, ROOT_URL } from "@/lib/seo";
import { currentUser } from "@/lib/session";
import {
  computeAnonymousIntercomBoot,
  computeIntercomBootForUser,
  intercomEnabled,
} from "@/lib/intercom";
import { getSiteBanner } from "@/lib/site-banner";
// import { WelcomeBackToast } from "@/components/WelcomeBackToast";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Mia's Quiz Tournament",
    template: "%s · Mia's Quiz Tournament",
  },
  description:
    "A friends-and-family tournament quiz site. New questions every day, host-driven finals (pre-taped this season), predictions bracket, and a blog.",
  applicationName: "Mia's Quiz Tournament",
  authors: [{ name: "Sam" }, { name: "Mia" }],
  keywords: [
    "quiz tournament",
    "family quiz",
    "trivia video",
    "question of the day",
    "trivia bracket",
    "Mia's Quiz",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    siteName: "Mia's Quiz Tournament",
    url: SITE_URL,
    title: "Mia's Quiz Tournament",
    description:
      "A friends-and-family tournament quiz site — daily questions, host-driven finals (pre-taped this season), theme song.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mia's Quiz Tournament",
    description:
      "Daily questions, host-driven finals (pre-taped this season), theme song, blog.",
  },
  // Default robots policy. Per-page metadata can override (e.g. signin
  // pages opt out via `robots: { index: false }`).
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: {
    // Cross-domain hint to the parent organization. Helps search +
    // answer engines associate quiz.miaswebsites.art with the parent
    // miaswebsites.art for shared authority.
    "dc.relation.IsPartOf": ROOT_URL,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Compute the Intercom boot server-side so the user_hash never
  // touches the bundle. When INTERCOM_APP_ID is unset, both branches
  // return null and the launcher silently disables.
  let intercom: Awaited<ReturnType<typeof computeIntercomBootForUser>> | null =
    null;
  if (intercomEnabled()) {
    try {
      const me = await currentUser();
      intercom = me
        ? await computeIntercomBootForUser(me)
        : computeAnonymousIntercomBoot();
    } catch {
      intercom = computeAnonymousIntercomBoot();
    }
  }

  // Site-wide announcement banner managed from /host/intercom.
  const banner = await getSiteBanner().catch(() => null);

  return (
    <html lang="en">
      <head>
        {/* Cross-subdomain authority signal — every page advertises a
            relationship to the root domain. */}
        <link rel="alternate" href={ROOT_URL} hrefLang="x-default" />
        {/* Site-wide JSON-LD: Organization + WebSite. Per-page LD
            blocks reference these via @id (#org / #site) so we don't
            re-emit the org on every page. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ld(organizationLD())}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ld(websiteLD())}
        />
      </head>
      <body>
        {banner ? (
          <HideOnWatch>
            <SiteBanner banner={banner} />
          </HideOnWatch>
        ) : null}
        {children}
        <VisitLogger />
        {intercom ? (
          <HideOnWatch>
            <IntercomBoot
              appId={intercom.appId}
              settings={intercom.settings}
            />
            <IntercomLauncher enabled />
            <IntercomTracker />
          </HideOnWatch>
        ) : null}
        {/* <WelcomeBackToast /> */}
      </body>
    </html>
  );
}
