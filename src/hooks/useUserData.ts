"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { scopedStorageKey } from "@/lib/user-scoped-storage";

export interface UseUserDataOptions<T> {
  /** Validate/migrate persisted values before they become component state. */
  sanitize?: (value: unknown) => T | null;
}

export function useUserData<T>(
  feature: string,
  initial: T,
  options: UseUserDataOptions<T> = {},
) {
  const { data: session, status } = useSession();
  const { sanitize } = options;
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const key = scopedStorageKey(
    feature,
    status === "authenticated" ? session?.user : null,
  );

  const coerce = useCallback(
    (value: unknown): T | null => {
      if (value == null) return null;
      if (!sanitize) return value as T;
      return sanitize(value);
    },
    [sanitize],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const accept = (value: unknown) => {
        const next = coerce(value);
        if (next === null) return false;
        if (!cancelled) {
          setData(next);
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(key, JSON.stringify(next));
            } catch {
              // Storage may be disabled or full; in-memory state still works.
            }
          }
        }
        return true;
      };

      try {
        if (status === "authenticated") {
          const res = await fetch(`/api/user-data?feature=${encodeURIComponent(feature)}`, { cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            if (!cancelled && json.data != null && accept(json.data)) return;
          }
        }

        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            let parsed: unknown = null;
            try {
              parsed = JSON.parse(raw);
            } catch {
              // Corrupt values are discarded below.
            }
            if (!accept(parsed) && typeof window !== "undefined") {
              window.localStorage.removeItem(key);
            }
          }
        }
      } catch {
        // Keep the initial value when both the API and local storage are unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [coerce, feature, key, status]);

  const save = useCallback(
    async (value: T) => {
      setData(value);
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(value));
      }
      if (status === "authenticated") {
        try {
          await fetch("/api/user-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feature, data: value }),
          });
        } catch {}
      }
    },
    [feature, key, status]
  );

  const clear = useCallback(async () => {
    setData(initial);
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
    if (status === "authenticated") {
      try {
        await fetch(`/api/user-data?feature=${encodeURIComponent(feature)}`, { method: "DELETE" });
      } catch {}
    }
  }, [feature, initial, key, status]);

  return { data, setData: save, clear, loading, isAuthed: status === "authenticated" };
}
