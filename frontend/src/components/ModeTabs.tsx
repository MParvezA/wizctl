export type ModeTab = "white" | "color" | "scenes";

interface ModeTabsProps {
  active: ModeTab;
  disabled?: boolean;
  onSelect: (tab: ModeTab) => void;
}

const TABS: { key: ModeTab; label: string }[] = [
  { key: "white", label: "White" },
  { key: "color", label: "Color" },
  { key: "scenes", label: "Scenes" },
];

export function ModeTabs({ active, disabled, onSelect }: ModeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Light mode"
      className="grid grid-cols-3 gap-1 rounded-full border border-room-600 bg-room-800/60 p-1"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onSelect(tab.key)}
            className={`rounded-full py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              isActive
                ? "bg-neutral-200 text-room-950"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
