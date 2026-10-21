"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

export function useUserData<T>(feature: string, initial: T) {
  const { data: session, status } = useSession();
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const key = `ejust:${feature}`;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        if (status === "authenticated") {
          const res = await fetch(`/api/user-data?feature=${encodeURIComponent(feature)}`, { cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            if (!cancelled && json.data !== null) {
              setData(json.data as T);
              setLoading(false);
              return;
            }
          }
        }

        if (typeof window !== "undefined") {
          const raw = localStorage.getItem(key);
          if (raw && !cancelled) {
            setData(JSON.parse(raw) as T);
          }
        }
      } catch {
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem(key);
          if (raw && !cancelled) setData(JSON.parse(raw) as T);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [feature, status, key]);

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
