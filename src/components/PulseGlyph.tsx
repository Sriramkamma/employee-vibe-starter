import { useId } from "react";

type GlyphKind = "mood" | "energy" | "workload";

type PulseGlyphProps = {
  value: number;
  kind: GlyphKind;
  size?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
) {
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
}

function sampleStops(stops: [number, number, number][], t: number) {
  const x = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  if (i >= stops.length - 1)
    return `rgb(${stops[stops.length - 1].join(",")})`;
  return lerpColor(stops[i], stops[i + 1], f);
}

// ─── Mood colour stops — sophisticated, not garish ───────────────────────────
// Very Difficult: muted rose-indigo
// Difficult:      dusty rose
// Okay:           cool periwinkle
// Good:           warm teal
// Excellent:      soft violet-lavender
const moodStops: [number, number, number][] = [
  [148,  88, 175],   // Very Difficult — muted violet-rose
  [168, 110, 130],   // Difficult      — dusty rose
  [120, 138, 210],   // Okay           — periwinkle
  [ 52, 188, 162],   // Good           — teal
  [155, 118, 248],   // Excellent      — soft electric violet
];

// ─── Energy colour stops ──────────────────────────────────────────────────────
// Low: slate-blue; High: warm amber-gold
const energyStops: [number, number, number][] = [
  [ 92, 102, 148],   // Very Low  — slate
  [118, 130, 195],   // Low       — blue
  [138, 128, 215],   // Normal    — blue-violet
  [222, 162,  58],   // Good      — amber
  [248, 188,  28],   // High      — gold
];

// ─── Workload colour stops ────────────────────────────────────────────────────
// Comfortable: calm emerald; Overwhelming: crimson-rose
const loadStops: [number, number, number][] = [
  [ 52, 188, 155],   // Comfortable  — emerald
  [ 78, 172, 128],   // Manageable   — muted green
  [128, 128, 192],   // Normal       — neutral violet
  [192,  92,  98],   // Heavy        — muted rose-red
  [210,  55,  80],   // Overwhelming — deep crimson
];

// ─── Cheek blush stops — always warm but intensity varies ────────────────────
const cheekStops: [number, number, number][] = [
  [200,  95, 120],   // Very Difficult — muted crimson blush
  [215, 130, 110],   // Difficult      — warm blush
  [180, 155, 195],   // Okay           — neutral mauve
  [105, 205, 185],   // Good           — teal-ish
  [185, 145, 248],   // Excellent      — soft violet
];

// ─────────────────────────────────────────────────────────────────────────────
// FACE component
// ─────────────────────────────────────────────────────────────────────────────

function Face({
  t,
  fill,
  invertSmile,
}: {
  t: number;
  fill: string;
  invertSmile?: boolean;
}) {
  const shineId = useId();
  const glowId  = useId();

  // Expression interpolations
  const smile   = invertSmile ? lerp(16, -20, t) : lerp(-20, 18, t);
  const eyeH    = invertSmile ? lerp(9, 5,   t) : lerp(5,  9.5, t);
  const eyeY    = invertSmile ? lerp(42, 40,  t) : lerp(40,  43, t);
  const brow    = invertSmile ? lerp(-6, 9,   t) : lerp(9,  -6,  t);
  const cheekA  = invertSmile ? lerp(0.06, 0.20, t) : lerp(0.06, 0.26, t);

  // Cheek colour interpolated separately for emotional resonance
  const cheekCol = sampleStops(cheekStops, t);

  // Eye pupil highlight drift: looks slightly up when happy, down when sad
  const pupilDY  = lerp(1.8, -0.8, t);

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        {/* Radial shine on face sphere */}
        <radialGradient id={shineId} cx="32%" cy="26%" r="68%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.58)" />
          <stop offset="42%"  stopColor="rgba(255,255,255,0.07)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.16)" />
        </radialGradient>
        {/* Subtle glow behind entire face */}
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* Face sphere base */}
      <circle cx="50" cy="50" r="42" fill={fill} />
      {/* Sheen overlay */}
      <circle cx="50" cy="50" r="42" fill={`url(#${shineId})`} />

      {/* Brow — left */}
      <path
        d={`M 27 ${38 + brow} Q 37 ${31.5 + brow * 0.22} 43.5 38`}
        fill="none"
        stroke="rgba(15,23,42,0.52)"
        strokeWidth="3.0"
        strokeLinecap="round"
      />
      {/* Brow — right */}
      <path
        d={`M 56.5 38 Q 63 ${31.5 + brow * 0.22} 73 ${38 + brow}`}
        fill="none"
        stroke="rgba(15,23,42,0.52)"
        strokeWidth="3.0"
        strokeLinecap="round"
      />

      {/* Eyes — left */}
      <ellipse cx="36" cy={eyeY}            rx="5.2" ry={eyeH / 2} fill="#0F172A" />
      {/* Eye highlight — left */}
      <ellipse cx="34.2" cy={eyeY - 1.2 + pupilDY} rx="1.5" ry="1.3" fill="#fff" />

      {/* Eyes — right */}
      <ellipse cx="64" cy={eyeY}            rx="5.2" ry={eyeH / 2} fill="#0F172A" />
      {/* Eye highlight — right */}
      <ellipse cx="62.2" cy={eyeY - 1.2 + pupilDY} rx="1.5" ry="1.3" fill="#fff" />

      {/* Cheeks */}
      <ellipse cx="31.5" cy="59" rx="7.5" ry="4.5"
        fill={cheekCol} opacity={cheekA} />
      <ellipse cx="68.5" cy="59" rx="7.5" ry="4.5"
        fill={cheekCol} opacity={cheekA} />

      {/* Mouth / smile curve */}
      <path
        d={`M 32 68 Q 50 ${68 + smile} 68 68`}
        fill="none"
        stroke="#0F172A"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENERGY MARK (battery + bolt)
// ─────────────────────────────────────────────────────────────────────────────

function EnergyMark({ t, fill }: { t: number; fill: string }) {
  const fillId = useId();
  const level  = lerp(18, 52, t);
  // Bolt appears only at high energy
  const bolt   = clamp((t - 0.50) / 0.50, 0, 1);

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={fillId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor={fill} />
          <stop offset="100%" stopColor="rgba(255,255,255,0.90)" />
        </linearGradient>
      </defs>

      {/* Battery casing */}
      <rect
        x="28" y="18" width="44" height="66" rx="11"
        fill="rgba(15,23,42,0.42)"
        stroke="rgba(255,255,255,0.24)"
        strokeWidth="2.5"
      />
      {/* Battery cap */}
      <rect
        x="40" y="13" width="20" height="8" rx="3"
        fill="rgba(255,255,255,0.50)"
      />
      {/* Fill level */}
      <rect
        x="33" y={78 - level} width="34" height={level} rx="7"
        fill={`url(#${fillId})`}
        opacity="0.95"
      />
      {/* Bolt */}
      <path
        d="M53 32 L41 54 H49 L45 70 L64 46 H53 Z"
        fill="#fff"
        opacity={bolt}
        style={{ filter: `drop-shadow(0 0 7px rgba(245,185,25,0.70))` }}
      />
    </svg>
  );
}

function PressureString({ value, fill }: { value: number; fill: string }) {
  const gradientId = useId();
  const t = clamp((value - 1) / 4, 0, 1);
  const span = lerp(42, 94, t);
  const left = 56 - span / 2;
  const right = 56 + span / 2;
  const slack = lerp(17, 1, t);
  const curve = `M ${left} 56 Q 56 ${56 + slack} ${right} 56`;
  const isMaxTension = t > 0.995;

  return (
    <svg
      viewBox="0 0 112 112"
      aria-hidden="true"
      className={isMaxTension ? "pressure-string-max" : undefined}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={fill} stopOpacity="0.55" />
          <stop offset="50%" stopColor={fill} />
          <stop offset="100%" stopColor={fill} stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <path d={curve} fill="none" stroke={fill} strokeOpacity="0.16" strokeWidth="12" strokeLinecap="round" />
      <path d={curve} fill="none" stroke={`url(#${gradientId})`} strokeWidth="4.5" strokeLinecap="round" />
      <path d={curve} fill="none" stroke="rgba(255,255,255,0.72)" strokeOpacity="0.52" strokeWidth="1" strokeLinecap="round" />
      <circle cx={left} cy="56" r="4.2" fill={fill} fillOpacity="0.9" />
      <circle cx={right} cy="56" r="4.2" fill={fill} fillOpacity="0.9" />
      <circle cx={left} cy="56" r="1.4" fill="rgba(255,255,255,0.88)" />
      <circle cx={right} cy="56" r="1.4" fill="rgba(255,255,255,0.88)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported PulseGlyph
// ─────────────────────────────────────────────────────────────────────────────

export function PulseGlyph({ value, kind, size = 92 }: PulseGlyphProps) {
  const t    = clamp((value - 1) / 4, 0, 1);
  const fill =
    kind === "mood"
      ? sampleStops(moodStops,   t)
      : kind === "energy"
        ? sampleStops(energyStops, t)
        : sampleStops(loadStops,   t);

  return (
    <span className="pulse-glyph" style={{ width: size, height: size }}>
      {kind === "workload" ? (
        <PressureString value={value} fill={fill} />
      ) : kind === "energy" ? (
        <EnergyMark t={t} fill={fill} />
      ) : (
        <Face t={t} fill={fill} />
      )}
    </span>
  );
}

export function glyphKindForStep(step: number): GlyphKind {
  if (step === 1) return "energy";
  if (step === 2) return "workload";
  return "mood";
}
