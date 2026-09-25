export type ModeTab = "white" | "color";

interface ModeTabsProps {
  active: ModeTab;
  disabled?: boolean;
  supportsColor: boolean;
  supportsColorTemp: boolean;
  onSelect: (tab: ModeTab) => void;
}

const TABS: { key: ModeTab; label: string }[] = [
  { key: "white", label: "White" },
  { key: "color", label: "Color" },
];

export function ModeTabs({ active, disabled, supportsColor, supportsColorTemp, onSelect }: ModeTabsProps) {
  const tabs = TABS.filter(tab => tab.key === "color" ? supportsColor : supportsColorTemp);
  if (!tabs.length) return null;
  return (
    <div
      role="tablist"
      aria-label="Light mode"
      className={`grid ${tabs.length === 2 ? "grid-cols-2" : "grid-cols-1"} gap-1 rounded-full border border-room-600 bg-room-800/60 p-1`}
    >
      {tabs.map((tab) => {
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
