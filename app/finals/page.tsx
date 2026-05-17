// Finals invitation landing page. Visitors land on a closed
// envelope on a wood-grain table. They click → the envelope flap
// peels open → the invitation card slides out → confetti pop → the
// page transforms into a long-scrolling event-details landing
// page.
//
// Featured from the homepage hero so anyone arriving via SMS link
// (the user is sending the PNG + video by text) sees the same
// moment of theatricality before scrolling to the event details.

import type { Metadata } from "next";
import { Stage } from "@/components/Stage";
import { EnvelopeStage } from "./EnvelopeStage";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "The Grand Final — now pre-taped",
  description:
    "Mia's Quiz Tournament — The Grand Final. The live Saturday broadcast has been replaced with a pre-recorded video sent to viewers. Click the envelope for details.",
  alternates: { canonical: `${SITE_URL}/finals` },
  openGraph: {
    title: "📼 The Grand Final — Mia's Quiz Tournament (now pre-taped)",
    description:
      "Change of plans: the live Saturday broadcast is cancelled. The finals will be recorded and emailed out as a watch-anytime video.",
    images: [
      {
        url: `${SITE_URL}/images/finals-invite.png`,
        width: 1200,
        height: 1600,
        alt: "Finals invitation",
      },
    ],
  },
};

export default function FinalsInvitePage() {
  return (
    <Stage scrollable>
      <EnvelopeStage />
    </Stage>
  );
}
