import type { CSSProperties } from "react";
import { Lightbulb, WifiOff } from "lucide-react";
import { kelvinToRgb } from "../lib/colorTemp";
import type { BulbInfo, BulbState } from "../lib/api";
import { reportedState, snapshotStatus, type LightSnapshot } from "./BulbSubscription";

export function lightAppearance(state: BulbState | null) {
  const rgb = state?.mode === "color" && state.rgb ? state.rgb : kelvinToRgb(state?.kelvin || 2700);
  const strength = state?.reachable && state.on ? Math.max(0, Math.min(100, state.brightness)) / 100 : 0;
  return { color: `rgb(${rgb.join(",")})`, strength };
}

export function RoomLight({ bulb, room, selected, snapshot, onSelect }: {
  bulb: BulbInfo; room: { id: string; name: string }; selected: boolean; snapshot?: LightSnapshot; onSelect: (ip: string) => void;
}) {
  const state = reportedState(snapshot);
  const { color, strength } = lightAppearance(state);
  const status = snapshotStatus(snapshot);
  const unavailable = !state?.reachable;
  return <button className={`room-marker ${selected ? "active" : ""} ${strength > 0 ? "illuminated" : ""} ${unavailable ? "unavailable" : ""}`} style={{ "--bulb-color": color, "--bulb-strength": strength } as CSSProperties} data-light-level={strength} data-light-color={color} data-light-status={status} aria-label={`Select ${bulb.name} in ${room.name}`} aria-pressed={selected} title={`${bulb.name}: ${status}`} onClick={() => onSelect(bulb.ip)}>{unavailable ? <WifiOff size={14} /> : <Lightbulb size={15} />}</button>;
}
