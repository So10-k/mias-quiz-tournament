import { palette, fonts } from "../theme";

// Minimal browser top-bar — three traffic lights, a URL pill — to ground
// each web-page scene in something that reads as "this is the site".
export const BrowserChrome: React.FC<{
  url: string;
  children: React.ReactNode;
  width?: number | string;
}> = ({ url, children, width = 1500 }) => {
  return (
    <div
      style={{
        width,
        background: "white",
        border: `4px solid ${palette.navy}`,
        borderRadius: 22,
        boxShadow: `12px 12px 0 0 ${palette.navy}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#F1F4FA",
          borderBottom: `3px solid ${palette.navy}`,
          height: 44,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 16px",
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: 999, background: "#FF6B6B" }} />
        <div style={{ width: 14, height: 14, borderRadius: 999, background: "#FFD93D" }} />
        <div style={{ width: 14, height: 14, borderRadius: 999, background: "#7DD87D" }} />
        <div
          style={{
            marginLeft: 24,
            background: "white",
            border: `2px solid ${palette.navy}`,
            borderRadius: 999,
            padding: "4px 14px",
            fontFamily: fonts.body,
            fontSize: 13,
            color: palette.navy,
            minWidth: 360,
          }}
        >
          🔒 {url}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
};
