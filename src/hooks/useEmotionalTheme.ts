/**
 * useEmotionalTheme
 * -----------------
 * Reusable emotional color-system engine for VIBE.
 * Maps a slider value (1–5) to a continuously interpolated palette.
 * Supports three semantic types: "mood" | "energy" | "workload"
 *
 * Design intent:
 *   - Colors are deliberately muted and sophisticated — not rainbow bright
 *   - All transitions are continuous (no step/class switching)
 *   - Three bloom layers for background depth
 *   - Surface tint for card ambient lighting
 */

export type EmotionalThemeType = "mood" | "energy" | "workload";

export type EmotionalTheme = {
  primary:    string;
  secondary:  string;
  glow:       string;
  borderGlow: string;
  bloom1:     string;
  bloom2:     string;
  label:      string;
  t:          number;
  cssVars:    Record<string, string>;
};

type RGB = [number, number, number];

// ─────────────────────────────────────────────────────────────────────────────
// MOOD palette
// State 1 → Very Difficult: deep indigo-navy + muted burgundy — heavy, serious
// State 2 → Difficult:      deep purple + warm dusky amber — slightly warmer
// State 3 → Okay:           cool midnight blue + soft violet — balanced
// State 4 → Good:           deep teal + soft emerald — alive, calm
// State 5 → Excellent:      deep indigo + electric violet/cyan — luminous, premium
// ─────────────────────────────────────────────────────────────────────────────
const MOOD = {
  primary:    [
    [100, 72,  168],   // Very Difficult — muted indigo
    [145, 78,  130],   // Difficult      — dusty rose-purple
    [ 82, 110, 200],   // Okay           — cool periwinkle
    [ 38, 172, 148],   // Good           — teal
    [128,  90, 248],   // Excellent      — electric violet
  ] as RGB[],
  secondary:  [
    [ 65, 45,  118],   // Very Difficult
    [112, 60,   90],   // Difficult
    [ 62,  88, 168],   // Okay
    [ 38, 198, 142],   // Good
    [ 30, 196, 228],   // Excellent
  ] as RGB[],
  glow:       [
    [ 72, 38,  130],   // Very Difficult
    [110, 52,   90],   // Difficult
    [ 58,  80, 175],   // Okay
    [ 32, 155, 128],   // Good
    [102,  65, 220],   // Excellent
  ] as RGB[],
  borderGlow: [
    [ 95, 55,  158],   // Very Difficult
    [138, 70,  110],   // Difficult
    [ 78, 100, 192],   // Okay
    [ 44, 178, 150],   // Good
    [130,  95, 240],   // Excellent
  ] as RGB[],
  // Background bloom A — large, top-left
  bloom1:     [
    [ 18, 12,  42],    // Very Difficult — near black-indigo
    [ 45, 18,  35],    // Difficult      — dark burgundy
    [ 18, 28,  72],    // Okay           — dark navy
    [ 10, 55,  58],    // Good           — deep teal
    [ 38, 18,  95],    // Excellent      — deep violet
  ] as RGB[],
  // Background bloom B — medium, bottom-right
  bloom2:     [
    [ 38, 12,  28],    // Very Difficult — dark wine
    [ 70, 32,  12],    // Difficult      — dark amber
    [ 28, 38,  95],    // Okay           — midnight
    [ 12, 78,  68],    // Good           — dark emerald
    [ 18, 55,  115],   // Excellent      — dark cyan-indigo
  ] as RGB[],
  // Surface tint — subtle card inner ambient
  surface:    [
    [ 60, 28,  90],    // Very Difficult
    [ 95, 48,  55],    // Difficult
    [ 48, 65,  140],   // Okay
    [ 28, 115, 100],   // Good
    [ 80, 48,  180],   // Excellent
  ] as RGB[],
  labels: ["Very Difficult", "Difficult", "Okay", "Good", "Excellent"],
};

// ─────────────────────────────────────────────────────────────────────────────
// ENERGY palette
// State 1 → Very Low: slate blue — dim, foggy
// State 5 → High:     amber/gold — energised, warm
// ─────────────────────────────────────────────────────────────────────────────
const ENERGY = {
  primary:    [
    [ 72,  85, 125],   // Very Low — dim slate
    [ 95, 108, 182],   // Low      — blue
    [118, 108, 210],   // Normal   — blue-violet
    [218, 148,  48],   // Good     — warm amber
    [245, 178,  22],   // High     — gold
  ] as RGB[],
  secondary:  [
    [ 55,  65, 100],
    [ 75,  88, 155],
    [ 95,  88, 182],
    [195, 128,  35],
    [232, 160,  18],
  ] as RGB[],
  glow:       [
    [ 45,  55,  95],
    [ 62,  75, 140],
    [ 88,  78, 165],
    [195, 118,  30],
    [235, 152,  15],
  ] as RGB[],
  borderGlow: [
    [ 65,  75, 115],
    [ 85,  98, 165],
    [108, 100, 192],
    [215, 138,  42],
    [242, 172,  20],
  ] as RGB[],
  bloom1:     [
    [ 18, 22,  52],
    [ 25, 30,  75],
    [ 35, 32,  85],
    [ 75, 48,  12],
    [ 95, 62,   8],
  ] as RGB[],
  bloom2:     [
    [ 28, 32,  65],
    [ 38, 48, 105],
    [ 55, 48, 120],
    [115, 78,  18],
    [148, 98,  12],
  ] as RGB[],
  surface:    [
    [ 45, 55,  105],
    [ 62, 78,  150],
    [ 82, 70,  170],
    [185, 115,  28],
    [225, 148,  15],
  ] as RGB[],
  labels: ["Very Low", "Low", "Normal", "Good", "High"],
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKLOAD palette
// State 1 → Comfortable: calm emerald — light, at ease
// State 5 → Overwhelming: deep crimson — heavy, pressured
// ─────────────────────────────────────────────────────────────────────────────
const WORKLOAD = {
  primary:    [
    [ 42, 178, 145],   // Comfortable  — cool emerald
    [ 72, 165, 120],   // Manageable   — muted green
    [118, 118, 190],   // Normal       — neutral blue-violet
    [185,  82,  88],   // Heavy        — muted rose
    [200,  48,  72],   // Overwhelming — deep crimson
  ] as RGB[],
  secondary:  [
    [ 35, 152, 122],
    [ 55, 142, 100],
    [ 98,  98, 168],
    [165,  62,  68],
    [178,  35,  58],
  ] as RGB[],
  glow:       [
    [ 28, 140, 112],
    [ 48, 130,  92],
    [ 88,  88, 158],
    [155,  52,  58],
    [168,  28,  50],
  ] as RGB[],
  borderGlow: [
    [ 46, 170, 138],
    [ 68, 158, 112],
    [112, 112, 182],
    [178,  75,  80],
    [195,  45,  68],
  ] as RGB[],
  bloom1:     [
    [ 10, 55,  48],
    [ 18, 55,  40],
    [ 38, 35,  78],
    [ 70, 25,  28],
    [ 85, 15,  25],
  ] as RGB[],
  bloom2:     [
    [ 15, 72,  62],
    [ 22, 68,  52],
    [ 55, 52,  100],
    [105, 35,  38],
    [122, 22,  38],
  ] as RGB[],
  surface:    [
    [ 28, 118,  95],
    [ 48, 108,  80],
    [ 78,  78, 160],
    [155,  58,  62],
    [172,  35,  55],
  ] as RGB[],
  labels: ["Comfortable", "Manageable", "Normal", "Heavy", "Overwhelming"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Color math helpers
// ─────────────────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function sampleRGB(stops: RGB[], t: number): RGB {
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  return lerpRGB(stops[i], stops[i + 1], x - i);
}

function rgb(c: RGB)               { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function rgba(c: RGB, a: number)   { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

function nearestLabel(labels: string[], t: number) {
  return labels[Math.min(Math.round(t * (labels.length - 1)), labels.length - 1)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useEmotionalTheme(
  value: number,
  type: EmotionalThemeType = "mood",
): EmotionalTheme {
  const t = Math.min(Math.max((value - 1) / 4, 0), 1);
  const p = type === "mood" ? MOOD : type === "energy" ? ENERGY : WORKLOAD;

  const primaryC     = sampleRGB(p.primary,    t);
  const secondaryC   = sampleRGB(p.secondary,  t);
  const glowC        = sampleRGB(p.glow,       t);
  const borderGlowC  = sampleRGB(p.borderGlow, t);
  const bloom1C      = sampleRGB(p.bloom1,     t);
  const bloom2C      = sampleRGB(p.bloom2,     t);
  const surfaceC     = sampleRGB(p.surface,    t);
  const label        = nearestLabel(p.labels,  t);

  // Slider fill percentage
  const fillPct = `${Math.round(t * 100)}%`;

  // Derived: subtle mid-tone for card surface gradient
  const cardSurface  = rgba(surfaceC, 0.08);
  // Derived: bright accent for progress bar cap/spark
  const spark        = rgba(primaryC, 0.80);

  const cssVars: Record<string, string> = {
    "--vibe-primary":       rgb(primaryC),
    "--vibe-secondary":     rgb(secondaryC),
    "--vibe-glow":          rgba(glowC, 0.52),
    "--vibe-glow-soft":     rgba(glowC, 0.25),
    "--vibe-border-glow":   rgba(borderGlowC, 0.38),
    "--vibe-bloom1":        rgba(bloom1C, 0.92),
    "--vibe-bloom2":        rgba(bloom2C, 0.82),
    "--vibe-surface-tint":  cardSurface,
    "--vibe-accent":        rgba(primaryC, 0.14),
    "--vibe-thumb-glow":    rgba(glowC, 0.62),
    "--vibe-btn-start":     rgb(primaryC),
    "--vibe-btn-end":       rgb(secondaryC),
    "--vibe-fill-pct":      fillPct,
    "--vibe-spark":         spark,
    "--thumb-color":        rgb(primaryC),
    // Base background tint (very subtle) that shifts whole page
    "--vibe-bg-tint":       rgba(bloom1C, 0.22),
  };

  return {
    primary:    rgb(primaryC),
    secondary:  rgb(secondaryC),
    glow:       rgba(glowC, 0.52),
    borderGlow: rgba(borderGlowC, 0.38),
    bloom1:     rgba(bloom1C, 0.92),
    bloom2:     rgba(bloom2C, 0.82),
    label,
    t,
    cssVars,
  };
}
