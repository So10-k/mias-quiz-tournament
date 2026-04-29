import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fonts, shadows } from "../theme";
import { BrowserChrome } from "../components/BrowserChrome";
import { PopButton } from "../components/PopButton";
import { Cursor } from "../components/Cursor";

// Three sub-beats inside this 15s scene:
//   0–60   inbox loading + email arriving
//   60–180 email opens, magic link visible
//   180–270 click magic link, fade
// Frames here are LOCAL to the scene (Sequence's from offset is handled by
// the parent).
export const EmailFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stage 1: inbox.
  const inboxIn = spring({ frame, fps, config: { damping: 14 } });
  const newEmailLand = spring({
    frame: frame - 50,
    fps,
    config: { damping: 12, mass: 0.7 },
  });

  // Stage 2: open email at frame 100.
  const opening = interpolate(frame, [100, 130], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Stage 3: click magic link near 230.
  const cursorX = interpolate(
    frame,
    [0, 60, 100, 200, 230],
    [1500, 1100, 1100, 960, 960],
    { extrapolateRight: "clamp" }
  );
  const cursorY = interpolate(
    frame,
    [0, 60, 100, 200, 230],
    [800, 380, 380, 760, 760],
    { extrapolateRight: "clamp" }
  );
  const linkClick = interpolate(frame, [230, 250], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const fadeOut = interpolate(frame, [250, 280], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* Inbox stage — under the opened-email layer */}
      <div
        style={{
          position: "absolute",
          transform: `scale(${(0.85 + inboxIn * 0.15) * (1 - opening * 0.06)})`,
          opacity: 1 - opening * 0.4,
        }}
      >
        <BrowserChrome url="mail.google.com" width={1280}>
          <div
            style={{
              background: "white",
              padding: "20px 0 0",
              minHeight: 540,
            }}
          >
            <div
              style={{
                padding: "10px 28px",
                borderBottom: `2px solid ${palette.navy}`,
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 20,
                color: palette.navy,
              }}
            >
              ✉️ Inbox
            </div>
            <InboxRow
              from="Mom"
              subject="hey, dinner plans?"
              when="9:32 AM"
              read
            />
            <InboxRow
              from="GitHub"
              subject="security alert"
              when="8:14 AM"
              read
            />
            <InboxRow
              from="School"
              subject="practice rescheduled"
              when="Yesterday"
              read
            />
            {/* New magic-link email lands. */}
            <div
              style={{
                transform: `translateY(${(1 - newEmailLand) * -60}px) scale(${
                  0.9 + newEmailLand * 0.1
                })`,
                opacity: newEmailLand,
                background: "#FFF8E2",
                borderTop: `3px solid ${palette.navy}`,
                borderBottom: `3px solid ${palette.navy}`,
              }}
            >
              <InboxRow
                from="Mia's Quiz Tournament"
                subject="Your magic link 🔮"
                when="just now"
                bold
              />
            </div>
          </div>
        </BrowserChrome>
      </div>

      {/* Opened email layer */}
      <div
        style={{
          position: "absolute",
          transform: `scale(${0.85 + opening * 0.15}) translateY(${
            (1 - opening) * 60
          }px)`,
          opacity: opening * (1 - fadeOut),
          pointerEvents: "none",
        }}
      >
        <OpenedMagicLinkEmail />
      </div>

      <Cursor x={cursorX} y={cursorY} click={Math.max(0, linkClick)} />
    </AbsoluteFill>
  );
};

const InboxRow: React.FC<{
  from: string;
  subject: string;
  when: string;
  bold?: boolean;
  read?: boolean;
}> = ({ from, subject, when, bold = false, read = false }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 28px",
        fontFamily: fonts.body,
        fontSize: 18,
        color: read ? palette.navySoft : palette.navy,
        borderBottom: "1px solid rgba(27,42,78,0.12)",
        fontWeight: bold ? 700 : 600,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          background: bold ? palette.coral : "transparent",
          borderRadius: 999,
        }}
      />
      <div style={{ width: 200 }}>{from}</div>
      <div style={{ flex: 1 }}>{subject}</div>
      <div style={{ color: palette.navySoft }}>{when}</div>
    </div>
  );
};

const OpenedMagicLinkEmail: React.FC = () => {
  return (
    <div
      style={{
        width: 700,
        background: "#B7E5FF",
        border: `4px solid ${palette.navy}`,
        borderRadius: 28,
        boxShadow: shadows.popLg,
        padding: 36,
      }}
    >
      <div
        style={{
          background: "white",
          border: `3px solid ${palette.navy}`,
          borderRadius: 22,
          padding: 28,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 999,
              background: palette.sun,
              border: `3px solid ${palette.navy}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
            }}
          >
            🌞
          </div>
          <div>
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 22,
                color: palette.navy,
              }}
            >
              Mia&rsquo;s Quiz Tournament
            </div>
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 600,
                fontSize: 13,
                color: palette.coralDeep,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              Your magic link
            </div>
          </div>
        </div>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 18,
            color: palette.navy,
            lineHeight: 1.5,
            margin: "0 0 10px",
          }}
        >
          Hi Mia! Click the button below to sign in. The link works once and
          expires in 10 minutes.
        </p>
        <div style={{ marginTop: 22, display: "flex", justifyContent: "center" }}>
          <PopButton variant="coral" size="lg">
            🔮 Sign in to the tournament
          </PopButton>
        </div>
      </div>
    </div>
  );
};
