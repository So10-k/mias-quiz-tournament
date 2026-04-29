import { palette, radii, shadows } from "../theme";

type Props = {
  children: React.ReactNode;
  width?: number | string;
  small?: boolean;
  style?: React.CSSProperties;
  bg?: string;
};

export const Card: React.FC<Props> = ({
  children,
  width,
  small = false,
  bg = palette.cloud,
  style,
}) => {
  return (
    <div
      style={{
        background: bg,
        border: `${small ? 3 : 4}px solid ${palette.navy}`,
        borderRadius: small ? radii.cardSm : radii.card,
        boxShadow: small ? shadows.pop : shadows.popLg,
        padding: small ? "16px 22px" : "32px 40px",
        width,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
