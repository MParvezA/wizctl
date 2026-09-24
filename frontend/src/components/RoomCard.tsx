import type { CSSProperties } from "react";
import { Lightbulb, WifiOff } from "lucide-react";
import type { BulbInfo } from "../lib/api";
import { reportedState, snapshotStatus, type LightSnapshot } from "./BulbSubscription";
import { lightAppearance } from "./RoomLight";

export function RoomCard({ bulb, roomName, snapshot, selected, onSelect }: {
  bulb: BulbInfo; roomName?: string; snapshot?: LightSnapshot; selected: boolean; onSelect: (ip: string) => void;
}) {
  const state = reportedState(snapshot);
  const { color, strength } = lightAppearance(state);
  const status = snapshotStatus(snapshot);
  const unavailable = !state?.reachable;
  return <button className={`room-card ${selected ? "selected" : ""} ${unavailable ? "unavailable" : ""}`} style={{ "--room-color": color, "--room-strength": strength } as CSSProperties} aria-label={`Control ${bulb.name}`} aria-pressed={selected} data-light-level={strength} data-light-status={status} onClick={() => onSelect(bulb.ip)}>
    <span className="room-card-heading"><span className={`room-color-swatch ${strength > 0 ? "on" : ""}`}>{unavailable ? <WifiOff size={17} /> : <Lightbulb size={17} />}</span><span><strong>{roomName ?? bulb.name}</strong><small>{roomName ? bulb.name : "Unassigned"}</small></span><span className="room-card-value">{status}</span></span>
    <span className="room-card-meter"><i style={{ width: `${strength * 100}%` }} /></span>
    <span className="room-card-footer"><span>{unavailable ? "State unavailable" : !state.on ? "Light off" : state.mode === "temp" ? `${state.kelvin} K` : "Color"}</span><span>{selected ? "Selected" : "Lighting"}</span></span>
  </button>;
}
