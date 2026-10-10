import { useEffect, useState } from 'react';

/**
 * Becomes true once `active` has stayed true for `delayMs`, then stays true (latched). Used to show
 * the waiting-room game only when loading is actually slow, so a fast load never flashes it.
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [reached, setReached] = useState(false);
  useEffect(() => {
    if (!active || reached) return;
    const id = setTimeout(() => setReached(true), delayMs);
    return () => clearTimeout(id);
  }, [active, reached, delayMs]);
  return reached;
}
