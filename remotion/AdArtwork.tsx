// Inline SVG hero illustrations for each parody ad. Hand-coded so we
// don't depend on AI image generation (the user's Gemini key was over
// daily quota when this was built — when it has quota again, run
// `node scripts/generate-ad-images.mjs` and the AdArtwork below will
// be swapped for the real PNG via the imageUrl prop on the ad).

import React from "react";

export type AdArtworkProps = {
  /** Total width — the parent decides; SVG scales. */
  size?: number;
};

// Shared helpers ------------------------------------------------------

const navy = "#1B2A4E";
const sun = "#FFD93D";
const coral = "#E94B7E";
const grass = "#5BCE7A";
const cream = "#FFF8E1";

const Stroke: React.FC<{ d: string; w?: number }> = ({ d, w = 4 }) => (
  <path d={d} fill="none" stroke={navy} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
);

// ---- 12 ad illustrations -------------------------------------------

export const BracketInsuranceArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Umbrella over a paper bracket */}
    <path d="M60 180 L340 180 L300 240 L100 240 Z" fill={cream} stroke={navy} strokeWidth={6} />
    {/* Bracket lines */}
    <Stroke d="M120 200 L180 200 L180 218 L240 218" />
    <Stroke d="M120 222 L180 222" />
    <Stroke d="M260 218 L320 218" />
    {/* Umbrella canopy */}
    <path d="M70 140 Q200 50 330 140 Z" fill={sun} stroke={navy} strokeWidth={6} />
    <path d="M150 140 Q200 80 250 140 Z" fill={coral} stroke={navy} strokeWidth={4} />
    {/* Umbrella stick */}
    <Stroke d="M200 140 L200 250" w={6} />
    <path d="M195 250 Q200 270 215 268" fill="none" stroke={navy} strokeWidth={6} strokeLinecap="round" />
    {/* Raindrops */}
    {[40, 380, 90, 350, 130, 280].map((x, i) => (
      <ellipse key={i} cx={x} cy={60 + (i % 3) * 18} rx={4} ry={8} fill="#87CEEB" stroke={navy} strokeWidth={2} />
    ))}
  </svg>
);

export const TriviaPillowArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Bed shape */}
    <rect x={20} y={220} width={360} height={60} fill="#C9A8B3" stroke={navy} strokeWidth={6} rx={12} />
    {/* Pillow */}
    <path
      d="M70 100 Q200 60 330 100 Q360 180 330 220 Q200 260 70 220 Q40 180 70 100 Z"
      fill="#FFD3DD"
      stroke={navy}
      strokeWidth={6}
    />
    {/* Embroidered question marks */}
    {[
      [120, 150, "?"],
      [200, 130, "Q"],
      [280, 160, "?"],
      [150, 200, "🌎"],
      [260, 200, "?"],
    ].map(([x, y, t], i) => (
      <text
        key={i}
        x={x as number}
        y={y as number}
        textAnchor="middle"
        fontFamily="Fredoka, sans-serif"
        fontWeight={700}
        fontSize={26}
        fill={navy}
      >
        {t}
      </text>
    ))}
  </svg>
);

export const HotTakeHotlineArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Flames behind */}
    {[80, 180, 280].map((x, i) => (
      <path
        key={i}
        d={`M${x} 250 Q${x - 30} 180 ${x} 130 Q${x + 30} 180 ${x} 250 Z`}
        fill={i % 2 === 0 ? coral : sun}
        stroke={navy}
        strokeWidth={4}
      />
    ))}
    {/* Phone receiver */}
    <g transform="translate(80 100) rotate(-15)">
      <rect x={0} y={20} width={240} height={70} fill={coral} stroke={navy} strokeWidth={6} rx={36} />
      <circle cx={36} cy={56} r={22} fill={cream} stroke={navy} strokeWidth={5} />
      <circle cx={204} cy={56} r={22} fill={cream} stroke={navy} strokeWidth={5} />
      <path d="M36 78 Q120 130 204 78" fill="none" stroke={navy} strokeWidth={6} strokeLinecap="round" />
    </g>
    {/* Lightning */}
    <path d="M340 60 L320 90 L335 95 L320 130" fill="none" stroke={sun} strokeWidth={6} strokeLinecap="round" />
  </svg>
);

export const StrikeCreamArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Tube */}
    <rect x={140} y={70} width={120} height={180} fill={grass} stroke={navy} strokeWidth={6} rx={20} />
    <rect x={150} y={60} width={100} height={20} fill={sun} stroke={navy} strokeWidth={5} rx={6} />
    <rect x={170} y={50} width={60} height={14} fill={cream} stroke={navy} strokeWidth={4} rx={4} />
    {/* Band-aid */}
    <g transform="translate(200 175) rotate(-15)">
      <rect x={-50} y={-12} width={100} height={24} fill="#FFE9B0" stroke={navy} strokeWidth={4} rx={10} />
      <circle cx={-30} cy={0} r={3} fill={navy} />
      <circle cx={-15} cy={0} r={3} fill={navy} />
      <circle cx={0} cy={0} r={3} fill={navy} />
      <circle cx={15} cy={0} r={3} fill={navy} />
      <circle cx={30} cy={0} r={3} fill={navy} />
    </g>
    {/* Stars */}
    {[60, 340, 100, 320].map((x, i) => (
      <text key={i} x={x} y={50 + (i % 2) * 200} fontSize={22}>⭐</text>
    ))}
  </svg>
);

export const MiasSchoolArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Open book */}
    <path d="M60 240 Q200 200 340 240 L340 130 Q200 90 60 130 Z" fill={cream} stroke={navy} strokeWidth={6} />
    <path d="M200 230 L200 105" stroke={navy} strokeWidth={4} />
    {[140, 180, 220, 260].map((y, i) => (
      <line key={i} x1={100} y1={y} x2={170} y2={y} stroke={navy} strokeWidth={2} />
    ))}
    {[140, 180, 220, 260].map((y, i) => (
      <line key={i} x1={230} y1={y} x2={300} y2={y} stroke={navy} strokeWidth={2} />
    ))}
    {/* Grad cap */}
    <g transform="translate(180 60)">
      <path d="M-50 20 L0 0 L50 20 L0 40 Z" fill={navy} stroke={navy} strokeWidth={3} />
      <rect x={-25} y={20} width={50} height={20} fill={navy} stroke={navy} strokeWidth={3} />
      <path d="M40 20 L70 50" stroke={sun} strokeWidth={4} />
      <circle cx={72} cy={52} r={6} fill={sun} stroke={navy} strokeWidth={2} />
    </g>
    {/* Sun mascot */}
    <circle cx={340} cy={70} r={22} fill={sun} stroke={navy} strokeWidth={4} />
    <circle cx={334} cy={68} r={2.5} fill={navy} />
    <circle cx={346} cy={68} r={2.5} fill={navy} />
    <path d="M332 76 Q340 82 348 76" fill="none" stroke={navy} strokeWidth={3} />
  </svg>
);

export const BracketMateArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Robot body */}
    <rect x={130} y={130} width={140} height={130} fill="#9BD9C7" stroke={navy} strokeWidth={6} rx={20} />
    {/* Head */}
    <rect x={140} y={60} width={120} height={80} fill="#9BD9C7" stroke={navy} strokeWidth={6} rx={16} />
    <circle cx={170} cy={100} r={14} fill={cream} stroke={navy} strokeWidth={4} />
    <circle cx={230} cy={100} r={14} fill={cream} stroke={navy} strokeWidth={4} />
    <circle cx={170} cy={100} r={6} fill={navy} />
    <circle cx={230} cy={100} r={6} fill={navy} />
    <rect x={185} y={120} width={30} height={6} fill={navy} rx={2} />
    {/* Antenna */}
    <line x1={200} y1={60} x2={200} y2={35} stroke={navy} strokeWidth={5} />
    <circle cx={200} cy={30} r={6} fill={coral} stroke={navy} strokeWidth={3} />
    {/* Arms holding clipboard */}
    <rect x={285} y={170} width={70} height={60} fill={cream} stroke={navy} strokeWidth={4} rx={6} />
    <rect x={305} y={155} width={30} height={20} fill={navy} stroke={navy} strokeWidth={3} rx={4} />
    {[185, 205, 225].map((y, i) => (
      <line key={i} x1={295} y1={y} x2={345} y2={y} stroke={navy} strokeWidth={2} />
    ))}
  </svg>
);

export const QuizVitaminsArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Gummy bear silhouette */}
    <path
      d="M200 60 Q170 60 165 90 L120 90 Q90 90 90 130 L90 200 Q90 250 130 250 L270 250 Q310 250 310 200 L310 130 Q310 90 280 90 L235 90 Q230 60 200 60 Z"
      fill="rgba(255,180,80,0.85)"
      stroke={navy}
      strokeWidth={6}
    />
    <circle cx={170} cy={150} r={8} fill={navy} />
    <circle cx={230} cy={150} r={8} fill={navy} />
    <path d="M180 180 Q200 195 220 180" fill="none" stroke={navy} strokeWidth={4} />
    {/* Lightbulb inside */}
    <g transform="translate(200 200)">
      <ellipse cx={0} cy={-10} rx={18} ry={20} fill={sun} stroke={navy} strokeWidth={3} />
      <rect x={-10} y={8} width={20} height={10} fill={navy} />
    </g>
    {/* Sparkles */}
    {[60, 340, 80, 320].map((x, i) => (
      <text key={i} x={x} y={60 + (i % 2) * 200} fontSize={22}>✨</text>
    ))}
  </svg>
);

export const BuzzerAppArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Buzzer base */}
    <ellipse cx={200} cy={230} rx={120} ry={30} fill={navy} />
    <rect x={120} y={150} width={160} height={80} fill={coral} stroke={navy} strokeWidth={6} rx={14} />
    {/* Buzzer top */}
    <ellipse cx={200} cy={155} rx={75} ry={28} fill={coral} stroke={navy} strokeWidth={6} />
    <ellipse cx={200} cy={150} rx={55} ry={18} fill="#F89BC0" stroke={navy} strokeWidth={3} />
    {/* Finger */}
    <g transform="translate(200 60)">
      <ellipse cx={0} cy={20} rx={32} ry={50} fill="#F2C49A" stroke={navy} strokeWidth={4} />
      <ellipse cx={0} cy={5} rx={20} ry={14} fill="#F2C49A" stroke={navy} strokeWidth={3} />
    </g>
    {/* Lightning bolts */}
    <path d="M60 60 L50 90 L70 95 L55 125" fill="none" stroke={sun} strokeWidth={5} strokeLinecap="round" />
    <path d="M340 60 L350 90 L330 95 L345 125" fill="none" stroke={sun} strokeWidth={5} strokeLinecap="round" />
  </svg>
);

export const DiscourseCatArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Laptop */}
    <path d="M80 230 L320 230 L340 270 L60 270 Z" fill="#D7CFB8" stroke={navy} strokeWidth={5} />
    <rect x={100} y={100} width={200} height={130} fill={navy} stroke={navy} strokeWidth={4} rx={6} />
    <rect x={108} y={108} width={184} height={114} fill="#3B4A7E" rx={3} />
    {/* Cat */}
    <g transform="translate(200 165)">
      <path d="M-50 30 L-50 -5 L-30 -25 L-15 -5 L15 -5 L30 -25 L50 -5 L50 30 Q0 50 -50 30 Z" fill="#E6B36A" stroke={navy} strokeWidth={5} />
      <circle cx={-18} cy={5} r={4} fill={navy} />
      <circle cx={18} cy={5} r={4} fill={navy} />
      <path d="M-3 14 L3 14 L0 18 Z" fill={navy} />
      <line x1={-30} y1={10} x2={-50} y2={6} stroke={navy} strokeWidth={2} />
      <line x1={30} y1={10} x2={50} y2={6} stroke={navy} strokeWidth={2} />
      {/* stripes */}
      <line x1={-20} y1={-10} x2={-10} y2={-20} stroke={navy} strokeWidth={3} />
      <line x1={0} y1={-12} x2={0} y2={-22} stroke={navy} strokeWidth={3} />
      <line x1={20} y1={-10} x2={10} y2={-20} stroke={navy} strokeWidth={3} />
    </g>
  </svg>
);

export const RewriteHistoryArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Test paper */}
    <rect x={80} y={50} width={240} height={220} fill={cream} stroke={navy} strokeWidth={6} rx={6} />
    {[90, 130, 170, 210].map((y, i) => (
      <g key={i}>
        <circle cx={110} cy={y} r={10} fill="none" stroke={navy} strokeWidth={3} />
        <circle cx={150} cy={y} r={10} fill={i === 1 ? coral : "none"} stroke={navy} strokeWidth={3} />
        <circle cx={190} cy={y} r={10} fill="none" stroke={navy} strokeWidth={3} />
        <circle cx={230} cy={y} r={10} fill="none" stroke={navy} strokeWidth={3} />
      </g>
    ))}
    {/* Pencil eraser */}
    <g transform="translate(280 200) rotate(20)">
      <rect x={-60} y={-25} width={120} height={50} fill="#FF8FA0" stroke={navy} strokeWidth={5} rx={8} />
      <rect x={-60} y={-25} width={20} height={50} fill="#C9296A" stroke={navy} strokeWidth={4} />
      <rect x={40} y={-22} width={20} height={44} fill="#F0C040" stroke={navy} strokeWidth={4} />
    </g>
    {/* Smudge marks */}
    <path d="M150 130 Q170 140 200 130" fill="none" stroke="#999" strokeWidth={10} strokeLinecap="round" opacity={0.6} />
  </svg>
);

export const WrongAnswerInsuranceArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Shield */}
    <path
      d="M200 50 L130 75 L130 170 Q130 230 200 260 Q270 230 270 170 L270 75 Z"
      fill={grass}
      stroke={navy}
      strokeWidth={6}
    />
    <text x={200} y={170} textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight={700} fontSize={70} fill={cream}>?</text>
    {/* Falling X */}
    <g transform="translate(310 100) rotate(20)">
      <line x1={-20} y1={-20} x2={20} y2={20} stroke={coral} strokeWidth={10} strokeLinecap="round" />
      <line x1={-20} y1={20} x2={20} y2={-20} stroke={coral} strokeWidth={10} strokeLinecap="round" />
    </g>
    {/* Sparkles */}
    {[40, 360, 80, 340].map((x, i) => (
      <text key={i} x={x} y={70 + (i % 2) * 180} fontSize={22}>✨</text>
    ))}
  </svg>
);

export const InternalMonologueArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Chair */}
    <rect x={140} y={210} width={120} height={70} fill="#8B5E3C" stroke={navy} strokeWidth={5} rx={8} />
    <rect x={130} y={180} width={140} height={50} fill="#A87555" stroke={navy} strokeWidth={5} rx={10} />
    {/* Lamp glow */}
    <ellipse cx={200} cy={120} rx={140} ry={50} fill={sun} opacity={0.25} />
    {/* Thought bubble */}
    <path
      d="M120 70 Q200 30 280 70 Q310 120 280 160 Q200 200 120 160 Q90 120 120 70 Z"
      fill={cream}
      stroke={navy}
      strokeWidth={6}
    />
    {/* Tangled yarn inside */}
    <path
      d="M150 110 Q200 80 250 110 Q230 130 250 150 Q200 170 150 150 Q170 130 150 110 Z"
      fill="none"
      stroke={coral}
      strokeWidth={4}
    />
    <circle cx={170} cy={120} r={4} fill={coral} />
    <circle cx={230} cy={140} r={4} fill={coral} />
    {/* Bubble tail */}
    <circle cx={150} cy={190} r={10} fill={cream} stroke={navy} strokeWidth={4} />
    <circle cx={135} cy={210} r={6} fill={cream} stroke={navy} strokeWidth={3} />
  </svg>
);

export const SamMiaAftershowArt: React.FC<AdArtworkProps> = () => (
  <svg viewBox="0 0 400 300" width="100%" height="100%">
    {/* Curtains */}
    <path d="M0 0 L60 0 L60 280 L0 280 Z" fill={coral} stroke={navy} strokeWidth={5} />
    <path d="M340 0 L400 0 L400 280 L340 280 Z" fill={coral} stroke={navy} strokeWidth={5} />
    {[10, 25, 40, 350, 365, 380].map((x, i) => (
      <line key={i} x1={x} y1={0} x2={x} y2={280} stroke="#C9296A" strokeWidth={3} />
    ))}
    {/* Stage floor */}
    <rect x={60} y={230} width={280} height={50} fill="#8B5E3C" stroke={navy} strokeWidth={5} />
    {/* Mic 1 */}
    <g transform="translate(160 180)">
      <rect x={-12} y={-50} width={24} height={50} fill={navy} stroke={navy} strokeWidth={3} rx={10} />
      <rect x={-3} y={0} width={6} height={50} fill={navy} />
      <rect x={-15} y={50} width={30} height={6} fill={navy} rx={3} />
    </g>
    {/* Mic 2 */}
    <g transform="translate(240 180)">
      <rect x={-12} y={-50} width={24} height={50} fill={navy} stroke={navy} strokeWidth={3} rx={10} />
      <rect x={-3} y={0} width={6} height={50} fill={navy} />
      <rect x={-15} y={50} width={30} height={6} fill={navy} rx={3} />
    </g>
    {/* Sun mascot */}
    <circle cx={200} cy={90} r={36} fill={sun} stroke={navy} strokeWidth={5} />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
      <line
        key={i}
        x1={200 + 42 * Math.cos((deg * Math.PI) / 180)}
        y1={90 + 42 * Math.sin((deg * Math.PI) / 180)}
        x2={200 + 58 * Math.cos((deg * Math.PI) / 180)}
        y2={90 + 58 * Math.sin((deg * Math.PI) / 180)}
        stroke={navy}
        strokeWidth={5}
        strokeLinecap="round"
      />
    ))}
    <circle cx={189} cy={86} r={3} fill={navy} />
    <circle cx={211} cy={86} r={3} fill={navy} />
    <path d="M188 99 Q200 108 212 99" fill="none" stroke={navy} strokeWidth={3} />
    {/* Confetti */}
    {[80, 320, 110, 280, 150, 250].map((x, i) => (
      <rect key={i} x={x} y={40 + (i % 3) * 25} width={8} height={12} fill={i % 2 === 0 ? sun : coral} stroke={navy} strokeWidth={2} transform={`rotate(${i * 30} ${x} ${50})`} />
    ))}
  </svg>
);

// Lookup ---------------------------------------------------------------

export const AD_ARTWORK: Record<string, React.FC<AdArtworkProps>> = {
  AdBracketInsurance: BracketInsuranceArt,
  AdTriviaPillow: TriviaPillowArt,
  AdHotTakeHotline: HotTakeHotlineArt,
  AdStrikeCream: StrikeCreamArt,
  AdMiasSchool: MiasSchoolArt,
  AdBracketMate: BracketMateArt,
  AdQuizVitamins: QuizVitaminsArt,
  AdBuzzerApp: BuzzerAppArt,
  AdDiscourseCat: DiscourseCatArt,
  AdRewriteHistory: RewriteHistoryArt,
  AdWrongAnswerInsurance: WrongAnswerInsuranceArt,
  AdInternalMonologue: InternalMonologueArt,
  AdSamMiaAftershow: SamMiaAftershowArt,
};
