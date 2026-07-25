import { useEffect, useRef, useState } from "react";

/**
 * A value that's driven by the server but must feel instantly draggable.
 *
 * Sliders bound directly to server state (e.g. `value={brightness}` from the
 * websocket) fight the user mid-drag: every tick sends a command and the
 * input can only move once that round-trip resolves, so the thumb stutters
 * or snaps back. This holds a local value during interaction and only
 * re-syncs from the server once the drag has settled.
 */
export function useOptimisticValue<T>(
  serverValue: T,
  onCommit: (value: T) => void,
  debounceMs: number,
) {
  const [local, setLocal] = useState<T>(serverValue);
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dragging.current) setLocal(serverValue);
  }, [serverValue]);

  const setValue = (value: T) => {
    dragging.current = true;
    setLocal(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onCommit(value);
      dragging.current = false;
    }, debounceMs);
  };

  return [local, setValue] as const;
}
