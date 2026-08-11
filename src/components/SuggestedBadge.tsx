"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 45_000;

export default function SuggestedBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetch("/api/suggested-chemicals/count")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data && typeof data.count === "number") setCount(data.count);
        })
        .catch(() => {});
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") load();
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (!count) return null;

  return (
    <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
      {count}
    </span>
  );
}
