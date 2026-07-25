import type { SceneInfo } from "../lib/api";

interface SceneGridProps {
  scenes: SceneInfo[];
  activeSceneId: number | null;
  disabled?: boolean;
  onSelect: (sceneId: number) => void;
}

export function SceneGrid({ scenes, activeSceneId, disabled, onSelect }: SceneGridProps) {
  if (!scenes.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-neutral-400">Color-changing scenes</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {scenes.map((scene) => {
          const active = scene.id === activeSceneId;
          return (
            <button
              key={scene.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onSelect(scene.id)}
              className={`truncate rounded-lg border px-3 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "border-neutral-300 bg-neutral-200 text-room-950"
                  : "border-room-600 bg-room-800/60 text-neutral-300 hover:border-room-600 hover:bg-room-700"
              }`}
            >
              {scene.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
