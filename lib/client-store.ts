"use client";

import { useSyncExternalStore } from "react";

// Tiny pub/sub for localStorage-backed UI flags (sidebar collapsed, theme).
// Why useSyncExternalStore instead of useState + useEffect: in React 19 the
// useState-in-effect pattern triggers `react-hooks/set-state-in-effect`, and
// useSyncExternalStore is also SSR-safe — it returns the server snapshot
// during the first client render, avoiding a hydration mismatch.

const listeners = new Map<string, Set<() => void>>();

function bucket(key: string) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

export function setStoredValue(key: string, value: string) {
  localStorage.setItem(key, value);
  bucket(key).forEach((fn) => fn());
}

export function useStoredValue(key: string, fallback: string): string {
  return useSyncExternalStore(
    (cb) => {
      const set = bucket(key);
      set.add(cb);
      return () => {
        set.delete(cb);
      };
    },
    () => {
      if (typeof window === "undefined") return fallback;
      return localStorage.getItem(key) ?? fallback;
    },
    () => fallback,
  );
}

// Read a value from a getter that only works on the client (e.g. navigator.platform).
// `serverValue` is what gets rendered during SSR and the first client render —
// pick something that matches the most likely client value to minimize the
// post-hydration flicker.
export function useClientValue<T>(getClientValue: () => T, serverValue: T): T {
  return useSyncExternalStore(
    () => () => {},
    getClientValue,
    () => serverValue,
  );
}
