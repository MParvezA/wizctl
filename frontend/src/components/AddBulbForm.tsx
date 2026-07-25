import { useState, type FormEvent } from "react";

interface AddBulbFormProps {
  pending: boolean;
  error: string | null;
  onAdd: (ip: string) => void;
}

const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;

export function AddBulbForm({ pending, error, onAdd }: AddBulbFormProps) {
  const [ip, setIp] = useState("");
  const valid = IP_PATTERN.test(ip.trim());

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || pending) return;
    onAdd(ip.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        <label htmlFor="bulb-ip" className="sr-only">
          Bulb IP address
        </label>
        <input
          id="bulb-ip"
          type="text"
          inputMode="decimal"
          placeholder="192.168.1.4"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          className="w-40 rounded-full border border-room-600 bg-room-800 px-4 py-2 text-center font-mono mono text-sm text-neutral-200 placeholder:text-neutral-600 focus-visible:outline-2"
        />
        <button
          type="submit"
          disabled={!valid || pending}
          className="rounded-full border border-room-600 bg-room-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-room-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Adding…" : "Add by IP"}
        </button>
      </div>
      {error && <p className="text-xs text-amber-400/90">{error}</p>}
    </form>
  );
}
