import { useEffect, useRef } from "react";

/**
 * Persist `value` to localStorage at `key`, debounced. Coalesces bursty
 * updates (e.g. cart qty steppers, every-keystroke preferences) into one
 * write per quiet window. Also flushes on unmount and on page hide so the
 * latest state survives reload / mobile background.
 */
export function useDebouncedStorage<T>(
  key: string,
  value: T,
  delayMs = 250,
) {
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const flush = () => {
      try {
        window.localStorage.setItem(key, JSON.stringify(valueRef.current));
      } catch {
        // ignore quota / private mode
      }
    };

    const id = setTimeout(flush, delayMs);
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [key, value, delayMs]);
}
