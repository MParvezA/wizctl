import { useMemo } from "react";
import type { BulbState } from "../lib/api";
import { getBulbRgb, getBulbStrength } from "../lib/bulbColor";
import { rgbToCss } from "../lib/colorTemp";

interface GlowProps {
  state: BulbState | null;
}

export function Glow({ state }: GlowProps) {
  const { color, strength } = useMemo(
    () => ({ color: getBulbRgb(state), strength: getBulbStrength(state) }),
    [state],
  );

  const size = 38 + strength * 32; // vmax — contained, not a full-screen wash
  const coreOpacity = 0.12 + strength * 0.38;
  const midOpacity = coreOpacity * 0.45;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 flex items-start justify-center overflow-hidden transition-[opacity] duration-[1200ms] ease-out motion-reduce:transition-none"
      style={{ opacity: strength === 0 ? 0.4 : 1 }}
    >
      <div
        className="rounded-full transition-all duration-[1200ms] ease-out motion-reduce:transition-none"
        style={{
          width: `${size}vmax`,
          height: `${size}vmax`,
          marginTop: "-6vmax",
          background: `radial-gradient(circle, ${rgbToCss(color, coreOpacity)} 0%, ${rgbToCss(
            color,
            midOpacity,
          )} 32%, rgba(11,12,14,0) 65%)`,
          filter: `blur(${28 + strength * 16}px)`,
        }}
      />
    </div>
  );
}
