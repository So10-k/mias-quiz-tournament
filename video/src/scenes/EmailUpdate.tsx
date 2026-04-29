import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fonts, shadows } from "../theme";
import { BrowserChrome } from "../components/BrowserChrome";

// 10s scene: a notification slides in showing a new email landed mid-
// tournament; we then open it and reveal the schedule-shift template the
// user can actually send from the host panel.
export const EmailUpdate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const notif = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, mass: 0.9 },
  });
  const openIn = interpolate(frame, [110, 145], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const fadeOut = interpolate(frame, [270, 300], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* Notification bubble */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 60,
          transform: `translateX(${(1 - notif) * 400}px)`,
          opacity: notif * (1 - openIn * 0.5) * (1 - fadeOut),
          zIndex: 5,
        }}
      >
        <div
          style={{
            background: "white",
            border: `3px solid ${palette.navy}`,
            borderRadius: 18,
            boxShadow: shadows.popLg,
            padding: 16,
            width: 380,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
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
                fontSize: 16,
                color: palette.navy,
              }}
            >
              Mia&rsquo;s Quiz Tournament
            </div>
            <div
              style={{
                fontFamily: fonts.body,
                fontSize: 14,
                color: palette.navySoft,
                marginTop: 3,
              }}
            >
              Updated schedule for this week&rsquo;s round
            </div>
          </div>
        </div>
      </div>

      {/* Opened email */}
      <div
        style={{
          transform: `scale(${0.86 + openIn * 0.14}) translateY(${
            (1 - openIn) * 60
          }px)`,
          opacity: openIn * (1 - fadeOut),
        }}
      >
        <BrowserChrome url="mail.google.com/u/0/#inbox/quiz-update" width={1100}>
          <SunnyEmail />
        </BrowserChrome>
      </div>
    </AbsoluteFill>
  );
};

const SunnyEmail: React.FC = () => {
  return (
    <div style={{ background: palette.sky1, padding: 36 }}>
      <div
        style={{
          background: "white",
          border: `4px solid ${palette.navy}`,
          borderRadius: 28,
          boxShadow: shadows.popLg,
          padding: 36,
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: palette.sun,
              border: `3px solid ${palette.navy}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
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
              A quick note from the desk
            </div>
          </div>
        </div>
        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 36,
            color: palette.navy,
            margin: "22px 0 10px",
          }}
        >
          Hi everyone! 👋
        </h2>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 18,
            color: palette.navy,
            lineHeight: 1.55,
            margin: "0 0 18px",
          }}
        >
          Quick apology — the schedule-change email earlier read a bit sloppier
          than I meant. Here&rsquo;s the actual plan for this week.
        </p>
        <div
          style={{
            background: palette.sky1,
            border: `3px solid ${palette.navy}`,
            borderRadius: 16,
            boxShadow: shadows.pop,
            padding: 20,
          }}
        >
          <p
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 14,
              color: palette.coralDeep,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              margin: "0 0 10px",
            }}
          >
            ⏰ This week&rsquo;s timing
          </p>
          <ScheduleRow icon="🚀" bg={palette.coral} label="Round goes live" when="Tonight · 8:30 PM" />
          <div style={{ borderTop: "2px dashed rgba(27,42,78,0.22)", margin: "10px 0" }} />
          <ScheduleRow icon="🏁" bg={palette.sun} label="Deadline to finish" when="Thursday · 9:00 PM" />
        </div>
      </div>
    </div>
  );
};

const ScheduleRow: React.FC<{
  icon: string;
  bg: string;
  label: string;
  when: string;
}> = ({ icon, bg, label, when }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: bg,
          border: `3px solid ${palette.navy}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          boxShadow: shadows.popSm,
        }}
      >
        {icon}
      </div>
      <div>
        <p
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 12,
            color: palette.navySoft,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 22,
            color: palette.navy,
            margin: "2px 0 0",
          }}
        >
          {when}
        </p>
      </div>
    </div>
  );
};
