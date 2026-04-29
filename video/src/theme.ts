// Design tokens — mirrored 1:1 from the live site so the video uses the
// exact same colour story as the product.
export const palette = {
  sky1: "#B7E5FF",
  sky2: "#87CEEB",
  sky3: "#5BA8D9",
  sun: "#FFD93D",
  sunDeep: "#F4A93A",
  cloud: "#FFFFFF",
  grass: "#7DD87D",
  grassDeep: "#4FB04F",
  coral: "#FF6B9D",
  coralDeep: "#E94B7E",
  berry: "#B23A8E",
  navy: "#1B2A4E",
  navySoft: "#3B4A7E",
  gold: "#C8A04C",
} as const;

export const fonts = {
  display: '"Fredoka", "Quicksand", system-ui, sans-serif',
  body: '"Quicksand", system-ui, sans-serif',
} as const;

export const shadows = {
  popSm: `2px 2px 0 0 ${palette.navy}`,
  pop: `4px 4px 0 0 ${palette.navy}`,
  popLg: `8px 8px 0 0 ${palette.navy}`,
} as const;

export const radii = {
  card: 24,
  cardSm: 18,
  button: 14,
  pill: 999,
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 3600, // 120s
} as const;
