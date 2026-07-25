import { useOptimisticValue } from "../hooks/useOptimisticValue";

interface SpeedSliderProps {
  value: number;
  disabled?: boolean;
  onChange: (speed: number) => void;
}

const MIN_SPEED = 10;
const MAX_SPEED = 200;

export function SpeedSlider({ value, disabled, onChange }: SpeedSliderProps) {
  const [local, setLocal] = useOptimisticValue(value, onChange, 80);
  const pct = ((local - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
  const fillColor = disabled ? "#3a3d43" : "#e5e5e5";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="speed" className="text-sm text-neutral-400">
          Effect speed
        </label>
        <span className="font-mono mono text-sm text-neutral-200">{local}</span>
      </div>
      <input
        id="speed"
        type="range"
        min={MIN_SPEED}
        max={MAX_SPEED}
        step={5}
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(Number(e.target.value))}
        className="slider h-2 w-full cursor-pointer rounded-full disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, ${fillColor} ${pct}%, #23262c ${pct}%)`,
        }}
      />
      <div className="flex justify-between font-mono mono text-[10px] text-neutral-600">
        <span>slower</span>
        <span>faster</span>
      </div>
    </div>
  );
}
