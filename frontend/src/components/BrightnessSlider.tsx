import { useOptimisticValue } from "../hooks/useOptimisticValue";

interface BrightnessSliderProps {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function BrightnessSlider({ value, disabled, onChange }: BrightnessSliderProps) {
  const [local, setLocal] = useOptimisticValue(value, onChange, 80);
  const pct = ((local - 10) / 90) * 100;
  const fillColor = disabled ? "#3a3d43" : "#e5e5e5";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="brightness" className="text-sm text-neutral-400">
          Brightness
        </label>
        <span className="font-mono mono text-sm text-neutral-200">{local}%</span>
      </div>
      <input
        id="brightness"
        type="range"
        min={10}
        max={100}
        step={1}
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(Number(e.target.value))}
        className="slider h-2 w-full cursor-pointer rounded-full disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, ${fillColor} ${pct}%, #23262c ${pct}%)`,
        }}
      />
    </div>
  );
}
