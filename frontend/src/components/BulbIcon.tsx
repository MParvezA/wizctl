import { useMemo } from "react";
import type { BulbState } from "../lib/api";
import { getBulbRgb, getBulbStrength } from "../lib/bulbColor";
import { rgbToCss } from "../lib/colorTemp";

interface BulbIconProps {
  state: BulbState | null;
}

export function BulbIcon({ state }: BulbIconProps) {
  const { color, strength } = useMemo(
    () => ({ color: getBulbRgb(state), strength: getBulbStrength(state) }),
    [state],
  );

  const glassFill = strength > 0 ? rgbToCss(color, 0.35 + strength * 0.5) : "rgba(255,255,255,0.05)";
  const glowShadow =
    strength > 0
      ? `0 0 ${16 + strength * 24}px ${rgbToCss(color, 0.35 + strength * 0.3)}`
      : "none";

  return (
    <div
      className="flex h-24 w-24 items-center justify-center transition-all duration-700 motion-reduce:transition-none sm:h-28 sm:w-28"
      style={{ filter: `drop-shadow(${glowShadow})` }}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" className="h-full w-full transition-colors duration-700 motion-reduce:transition-none">
        <circle
          cx="24"
          cy="19"
          r="14"
          fill={glassFill}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.25"
        />
        <path
          d="M19 26.5h10l-1 4.5a2 2 0 01-2 1.6h-4a2 2 0 01-2-1.6l-1-4.5z"
          fill="#2a2d33"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
        <rect x="19.5" y="34" width="9" height="2.2" rx="1.1" fill="#23262c" />
        <rect x="20" y="37.2" width="8" height="2.2" rx="1.1" fill="#1c1e23" />
      </svg>
    </div>
  );
}
