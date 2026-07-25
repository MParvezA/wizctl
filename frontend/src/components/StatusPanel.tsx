import type { BulbState } from "../lib/api";

interface StatusPanelProps {
  state: BulbState | null;
  wsConnected: boolean;
}

interface Tile {
  label: string;
  value: string;
  sub?: string;
  dot?: string;
}

function signalQuality(rssi: number): string {
  if (rssi >= -50) return "Excellent";
  if (rssi >= -60) return "Good";
  if (rssi >= -70) return "Fair";
  return "Weak";
}

export function StatusPanel({ state, wsConnected }: StatusPanelProps) {
  if (!state) {
    return <div className="font-mono mono text-xs text-neutral-500">connecting…</div>;
  }

  if (!state.reachable) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-400/90">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/90" />
        <span>unreachable — {state.message ?? "no response from bulb"}</span>
      </div>
    );
  }

  const modeValue =
    state.mode === "color"
      ? "Color"
      : state.mode === "temp"
        ? "White"
        : state.mode === "scene"
          ? (state.sceneName ?? `Scene ${state.sceneId ?? "?"}`)
          : "—";

  const tiles: Tile[] = [
    {
      label: "State",
      value: state.on ? "On" : "Off",
      dot: state.on ? "bg-emerald-400/90" : "bg-neutral-600",
    },
    { label: "Brightness", value: `${state.brightness}%` },
  ];

  if (state.mode === "scene" && state.speed != null) {
    tiles.push({ label: "Speed", value: String(state.speed) });
  }

  if (state.rssi != null) {
    tiles.push({ label: "Signal", value: signalQuality(state.rssi), sub: `${state.rssi} dBm` });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 rounded-xl border border-room-700 bg-room-800/40 px-3 py-2">
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-500">Mode</span>
        <span className="truncate text-right font-mono mono text-sm text-neutral-200">
          {modeValue}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-1 rounded-xl border border-room-700 bg-room-800/40 px-3 py-2"
          >
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">
              {tile.label}
            </span>
            <span className="flex items-center gap-1.5 truncate font-mono mono text-sm text-neutral-200">
              {tile.dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tile.dot}`} />}
              {tile.value}
            </span>
            {tile.sub && (
              <span className="font-mono mono text-[10px] text-neutral-600">{tile.sub}</span>
            )}
          </div>
        ))}
      </div>
      {!wsConnected && (
        <span className="font-mono mono text-[10px] text-amber-400/80">reconnecting…</span>
      )}
    </div>
  );
}
