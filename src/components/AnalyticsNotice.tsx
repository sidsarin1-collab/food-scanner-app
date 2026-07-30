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
          We log anonymous usage to improve this tool: a random session ID (no login, name, or
          email), the product or ingredient list you checked (or a one-way hash of it if you
          didn&apos;t name it), the result shown, your self-selected country, and whether you
          viewed alternatives. No precise location, and no third-party analytics or ad scripts.
          To request deletion of your data, email{" "}
          <a
            href="mailto:sid.sarin1@gmail.com?subject=Delete%20my%20scanner%20usage%20data"
            className="underline"
          >
            sid.sarin1@gmail.com
          </a>
          .
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
