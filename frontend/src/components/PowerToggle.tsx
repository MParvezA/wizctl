interface PowerToggleProps {
  on: boolean;
  disabled?: boolean;
  onToggle: (on: boolean) => void;
}

export function PowerToggle({ on, disabled, onToggle }: PowerToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Turn bulb off" : "Turn bulb on"}
      disabled={disabled}
      onClick={() => onToggle(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "border-neutral-300 bg-neutral-200" : "border-room-600 bg-room-800"
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-6 w-6 rounded-full shadow-md transition-transform duration-300 ${
          on ? "translate-x-6 bg-room-950" : "translate-x-0 bg-neutral-500"
        }`}
      />
    </button>
  );
}
