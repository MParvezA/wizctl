import type { BulbInfo } from "../lib/api";

interface BulbSelectorProps {
  bulbs: BulbInfo[];
  selectedIp: string;
  onSelect: (ip: string) => void;
}

export function BulbSelector({ bulbs, selectedIp, onSelect }: BulbSelectorProps) {
  if (bulbs.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Select bulb"
      className="inline-flex gap-1 rounded-full border border-room-600 bg-room-900/80 p-1 backdrop-blur-sm"
    >
      {bulbs.map((bulb) => {
        const active = bulb.ip === selectedIp;
        return (
          <button
            key={bulb.ip}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(bulb.ip)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 ${
              active
                ? "bg-neutral-200 text-room-950"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {bulb.name}
          </button>
        );
      })}
    </div>
  );
}
