import type { BulbState } from "./api";
import { kelvinToRgb } from "./colorTemp";

const FALLBACK_WARM: [number, number, number] = [255, 214, 170];

/**
 * The bulb's actual rendered color, independent of which control last set
 * it — rgb takes priority (true color mode or a color-changing scene),
 * falling back to the correlated color of its Kelvin, then a neutral warm
 * default. Shared by the ambient glow and the bulb glyph so they always
 * agree on what the light looks like.
 */
export function getBulbRgb(state: BulbState | null): [number, number, number] {
  if (!state) return FALLBACK_WARM;
  if (state.rgb) return state.rgb;
  if (state.kelvin) return kelvinToRgb(state.kelvin);
  return FALLBACK_WARM;
}

export function getBulbStrength(state: BulbState | null): number {
  if (!state || !state.reachable || !state.on) return 0;
  return Math.max(state.brightness, 10) / 100;
}
