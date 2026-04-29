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

const NAME = "Mia";
const EMAIL = "mia@miaswebsites.art";

const typed = (s: string, frame: number, start: number, perChar: number) => {
  const local = Math.max(0, frame - start);
  const idx = Math.min(s.length, Math.floor(local / perChar));
  return s.slice(0, idx);
};

export const Signup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({ frame: frame - 5, fps, config: { damping: 14 } });
  const nameTyped = typed(NAME, frame, 25, 7);
  const emailTyped = typed(EMAIL, frame, 70, 5);
  const cursorX = interpolate(
    frame,
    [0, 25, 70, 200, 230, 260],
    [1700, 770, 770, 1080, 1080, 1080],
    { extrapolateRight: "clamp" }
  );
  const cursorY = interpolate(
    frame,
    [0, 25, 70, 200, 230, 260],
    [900, 360, 480, 600, 600, 600],
    { extrapolateRight: "clamp" }
  );
  const click = interpolate(frame, [240, 260], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const buttonPress = interpolate(frame, [240, 260, 280], [0, 1, 0.4], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Form blur-out as the email "sends".
  const sendOut = interpolate(frame, [275, 300], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: `scale(${0.85 + cardIn * 0.15}) translateY(${(1 - sendOut) * 0 + sendOut * -80}px)`,
          opacity: 1 - sendOut * 0.5,
        }}
      >
        <BrowserChrome url="quiz.miaswebsites.art/join" width={1200}>
          <div style={{ padding: "44px 56px" }}>
            <p
              style={{
                fontFamily: fonts.display,
                fontSize: 16,
                color: palette.navySoft,
                letterSpacing: 2,
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Join the tournament
            </p>
            <h2
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 56,
                color: palette.navy,
                margin: "10px 0 28px",
              }}
            >
              Sign up below 🌞
            </h2>

            <Field label="Your name" value={nameTyped} active={frame < 70} />
            <div style={{ height: 16 }} />
            <Field
              label="Your email"
              value={emailTyped}
              active={frame >= 70 && frame < 200}
            />

            <div style={{ marginTop: 36 }}>
              <PopButton variant="coral" size="lg" pressed={buttonPress}>
                ✉️ Send me a magic link
              </PopButton>
            </div>
          </div>
        </BrowserChrome>
      </div>
      <Cursor x={cursorX} y={cursorY} click={click} />
    </AbsoluteFill>
  );
};

const Field: React.FC<{ label: string; value: string; active?: boolean }> = ({
  label,
  value,
  active = false,
}) => {
  return (
    <div>
      <p
        style={{
          fontFamily: fonts.display,
          fontSize: 22,
          color: palette.navy,
          margin: "0 0 8px",
        }}
      >
        {label}
      </p>
      <div
        style={{
          background: "white",
          border: `3px solid ${active ? palette.coral : palette.navy}`,
          borderRadius: 12,
          boxShadow: active
            ? `3px 3px 0 0 ${palette.coral}`
            : shadows.popSm,
          padding: "14px 18px",
          fontFamily: fonts.body,
          fontSize: 26,
          color: palette.navy,
          minHeight: 30,
        }}
      >
        {value}
        {active ? (
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: 28,
              background: palette.navy,
              marginLeft: 2,
              verticalAlign: "middle",
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
