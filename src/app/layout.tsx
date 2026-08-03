import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import AnalyticsNotice from "@/components/AnalyticsNotice";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ingredient Safety Scanner",
  description: "Paste an ingredient list and see what's flagged and why.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">
              Ingredient Safety Scanner
            </Link>
            <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-800">
              Admin
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-3xl px-4 pb-6 text-center">
          <a
            href="https://buy.stripe.com/test_5kQ00k4XwbKS85X9E0bV600"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
          >
            <span aria-hidden="true">☕</span>
            Support this project
          </a>
        </footer>
        <AnalyticsNotice />
      </body>
    </html>
  );
}
