import { RgbColorPicker } from "react-colorful";
import { useOptimisticValue } from "../hooks/useOptimisticValue";

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface ColorPickerProps {
  value: RgbColor;
  disabled?: boolean;
  onChange: (color: RgbColor) => void;
}

export function ColorPicker({ value, disabled, onChange }: ColorPickerProps) {
  const [local, setLocal] = useOptimisticValue(value, onChange, 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`w-full max-w-[260px] ${disabled ? "pointer-events-none opacity-40" : ""}`}
        style={{ aspectRatio: "1 / 1" }}
      >
        <RgbColorPicker color={local} onChange={setLocal} style={{ width: "100%", height: "100%" }} />
      </div>
      <span className="font-mono mono text-sm text-neutral-400">
        rgb({local.r}, {local.g}, {local.b})
      </span>
    </div>
  );
}
