import { useEffect, useState } from "react";
import { logger } from "./logger.js";

const REFRESH_MS = 3000;

export function usePolled<T>(load: () => Promise<T>, name: string, live = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let failing = false;

    const tick = async () => {
      try {
        const result = await load();
        if (!cancelled) {
          if (failing) {
            failing = false;
            logger.info({ table: name }, "table recovered");
          }
          setData(result);
          setError(null);
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (!cancelled) {
          if (!failing) {
            failing = true;
            logger.error({ table: name, err: message }, "table failed to load");
          }
          setError(message);
        }
      }
    };

    void tick();

    if (!live) {
      return () => {
        cancelled = true;
      };
    }

    const timer = setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load, name, live]);

  return { data, error };
}
