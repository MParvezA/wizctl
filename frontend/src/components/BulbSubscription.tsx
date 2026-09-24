import { useEffect } from "react";
import { useBulbState } from "../hooks/useBulbState";
import type { BulbState } from "../lib/api";

export interface LightSnapshot { state: BulbState | null; connected: boolean }
export type LightSnapshots = Record<string, LightSnapshot>;

export function BulbSubscription({ ip, onUpdate }: { ip: string; onUpdate: (ip: string, snapshot: LightSnapshot | null) => void }) {
  const { state, connected } = useBulbState(ip);
  useEffect(() => { onUpdate(ip, { state, connected }); }, [ip, state, connected, onUpdate]);
  useEffect(() => () => onUpdate(ip, null), [ip, onUpdate]);
  return null;
}

export function reportedState(snapshot?: LightSnapshot): BulbState | null {
  return snapshot?.connected ? snapshot.state : null;
}

export function snapshotStatus(snapshot?: LightSnapshot): string {
  if (!snapshot?.connected) return snapshot?.state ? "Unavailable" : "Connecting";
  if (!snapshot.state) return "Reading state";
  if (!snapshot.state.reachable) return "Unavailable";
  return snapshot.state.on ? `${snapshot.state.brightness}%` : "Off";
}
