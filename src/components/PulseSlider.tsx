import { useRef, useState } from "react";
import { PulseGlyph, glyphKindForStep } from "./PulseGlyph";
import type { EmotionalTheme } from "../hooks/useEmotionalTheme";

type Option = { label: string; value: number };

type PulseSliderProps = {
  stepIndex: number;
  value: number;
  options: Option[];
  /** @deprecated pass theme instead */
  accent?: string;
  theme: EmotionalTheme;
  onChange: (value: number) => void;
};

export function PulseSlider({
  stepIndex,
  value,
  options,
  theme,
  onChange,
}: PulseSliderProps) {
  const current  = options.find((o) => o.value === Math.round(value)) ?? options[2];
  const fillPct  = ((value - 1) / 4) * 100;
  const kind     = glyphKindForStep(stepIndex);
  const [dragging, setDragging] = useState(false);
  const prevLabel = useRef(current.label);

  const labelChanged = current.label !== prevLabel.current;
  if (labelChanged) prevLabel.current = current.label;

  // ── Track gradient ────────────────────────────────────────────────────────
  // Filled portion: primary → secondary; unfilled: very subtle white
  const trackBg = `linear-gradient(90deg,
    var(--vibe-primary) 0%,
    var(--vibe-secondary) ${fillPct}%,
    rgba(255,255,255,0.065) ${fillPct}%,
    rgba(255,255,255,0.065) 100%)`;

  // ── Aura intensities ──────────────────────────────────────────────────────
  // Outer aura fades from 0.06 (very-difficult) to 0.26 (excellent)
  const outerAuraOpacity = 0.06 + theme.t * 0.20;
  // Inner halo: slightly stronger
  const haloOpacity      = 0.38 + theme.t * 0.20;

  return (
    <div className="premium-slider-container">

      {/* ── Avatar Stage ── */}
      <div
        className={`glyph-stage${dragging ? " glyph-dragging" : ""}`}
        style={{ "--glyph-ring": theme.borderGlow } as React.CSSProperties}
      >
        {/* Large diffuse outer aura */}
        <div
          className="glyph-aura-outer"
          style={{
            background: theme.primary,
            opacity: outerAuraOpacity,
          }}
        />

        {/* Crisp inner bloom behind the face */}
        <div
          className="glyph-halo"
          style={{
            background: `radial-gradient(circle, ${theme.primary} 0%, ${theme.secondary} 55%, transparent 100%)`,
            opacity: haloOpacity,
          }}
        />

        {/* Fine proximity ring — visible at positive extremes */}
        <div className="glyph-ring" />

        <PulseGlyph value={value} kind={kind} size={112} />
      </div>

      {/* ── Emotional label ── */}
      <p
        className="slider-label"
        key={current.label}   /* re-mounts on change → triggers CSS animation */
        style={{ color: theme.primary }}
      >
        {current.label}
      </p>

      {/* ── Slider track ── */}
      <div className="slider-wrap">
        {/* Ambient glow bloom beneath the track */}
        <div
          className="slider-track-glow"
          style={{
            background: theme.primary,
            opacity: 0.14 + theme.t * 0.16,
          }}
        />

        <input
          type="range"
          className="premium-slider"
          min={1}
          max={5}
          step={0.02}
          value={value}
          aria-valuetext={current.label}
          aria-label={`Slider: ${current.label}`}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => { setDragging(false); onChange(Math.round(value)); }}
          onKeyUp={() => onChange(Math.round(value))}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            background: trackBg,
            ["--thumb-color" as string]:    theme.primary,
            ["--vibe-thumb-glow" as string]: theme.glow,
          }}
        />

        {/* Tick mark buttons (also act as click targets) */}
        <div className="slider-ticks">
          {options.map((option) => {
            const isActive = Math.round(value) === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`slider-tick${isActive ? " active" : ""}`}
                aria-label={`Select ${option.label}`}
                aria-pressed={isActive}
                onClick={() => onChange(option.value)}
                style={
                  isActive
                    ? ({ "--tick-color": theme.primary } as React.CSSProperties)
                    : undefined
                }
              >
                <span />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scale endpoint labels ── */}
      <div className="slider-scale">
        <span>{options[0].label}</span>
        <span>{options[4].label}</span>
      </div>
    </div>
  );
}
