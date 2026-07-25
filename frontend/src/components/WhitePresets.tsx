import type { SceneInfo } from "../lib/api";

interface WhitePresetsProps {
  presets: SceneInfo[];
  activeSceneId: number | null;
  disabled?: boolean;
  onSelect: (sceneId: number) => void;
}

export function WhitePresets({ presets, activeSceneId, disabled, onSelect }: WhitePresetsProps) {
  if (!presets.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-neutral-400">White looks</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {presets.map((preset) => {
          const active = preset.id === activeSceneId;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onSelect(preset.id)}
              className={`truncate rounded-lg border px-3 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "border-neutral-300 bg-neutral-200 text-room-950"
                  : "border-room-600 bg-room-800/60 text-neutral-300 hover:bg-room-700"
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
