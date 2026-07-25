import { useOptimisticValue } from "../hooks/useOptimisticValue";

interface TempSliderProps {
  value: number;
  disabled?: boolean;
  onChange: (kelvin: number) => void;
}

const MIN_K = 2200;
const MAX_K = 6500;

export function TempSlider({ value, disabled, onChange }: TempSliderProps) {
  const [local, setLocal] = useOptimisticValue(value, onChange, 80);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="temp" className="text-sm text-neutral-400">
          White temperature
        </label>
        <span className="font-mono mono text-sm text-neutral-200">{local}K</span>
      </div>
      <input
        id="temp"
        type="range"
        min={MIN_K}
        max={MAX_K}
        step={50}
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(Number(e.target.value))}
        className="slider h-2 w-full cursor-pointer rounded-full disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          background:
            "linear-gradient(to right, #ff9a4d 0%, #ffcf9e 25%, #fff6ea 50%, #d9edff 75%, #a9d4ff 100%)",
        }}
      />
      <div className="flex justify-between font-mono mono text-[10px] text-neutral-600">
        <span>2200K warm</span>
        <span>6500K cool</span>
      </div>
    </div>
  );
}
