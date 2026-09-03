"use client";

import { useEffect, useState } from "react";
import { acknowledgeNotice, hasAcknowledgedNotice } from "@/lib/analytics";

export default function AnalyticsNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasAcknowledgedNotice());
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-300 bg-white p-4 text-sm shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-neutral-700">
          We collect limited usage information to improve the app, but never your name, email,
          precise location or IP address—and we don&apos;t use your data for advertising.
        </p>
        <button
          onClick={() => {
            acknowledgeNotice();
            setVisible(false);
          }}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
