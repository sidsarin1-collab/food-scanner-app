import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "How We Evaluate Ingredients | FoodPurityScanner",
  description:
    "How FoodPurityScanner classifies food additives: source, jurisdiction, regulatory classification, and date checked -- with real examples from our database.",
  alternates: {
    canonical: `${SITE_URL}/how-we-evaluate-ingredients`,
  },
};

const TIER_LABEL: Record<number, string> = { 1: "Bad", 2: "Badder", 3: "Ugly" };

// One real, currently-live example per classification bucket, pulled from
// the actual chemicals table rather than hardcoded -- if these rows change
// or get re-tiered, this page reflects that automatically.
const EXAMPLE_NAMES = ["Titanium Dioxide", "Sodium Diacetate", "Ferrous Sulfate"];

export default async function MethodologyPage() {
  const examples = await prisma.chemical.findMany({
    where: { name: { in: EXAMPLE_NAMES } },
    select: {
      name: true,
      severityTier: true,
      category: true,
      bannedInCountries: true,
      sourceNote: true,
      lastUpdated: true,
    },
  });
  const byName = new Map(examples.map((e) => [e.name, e]));

  return (
    <article className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">How We Evaluate Ingredients</h1>
        <p className="mt-2 text-neutral-700">
          Every additive in our database goes through the same four-step check. Here&apos;s exactly what that
          looks like, with live examples pulled straight from our current data.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">The pipeline: source → jurisdiction → classification → date checked</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-700">
          <li>
            <strong>Source:</strong> a specific regulatory action or publication — a regulation number, an
            agency ruling, a positive-list entry or its absence — not a general impression of a substance&apos;s
            reputation.
          </li>
          <li>
            <strong>Jurisdiction:</strong> which of the six regulatory bodies (see{" "}
            <a href="/regulatory-sources" className="underline">
              Regulatory Sources
            </a>
            ) the action applies to. The same substance can be treated differently in different places.
          </li>
          <li>
            <strong>Regulatory classification:</strong> food regulation isn&apos;t binary. We record whether a
            substance is <em>prohibited</em> (banned outright), <em>restricted</em> (permitted only in specific
            food categories, capped at a maximum level, or requiring a warning label), <em>under review</em>{" "}
            (an agency has an active re-evaluation but hasn&apos;t issued a final ruling), or <em>permitted</em>{" "}
            under general conditions.
          </li>
          <li>
            <strong>Date checked:</strong> regulatory status changes. Every entry records when it was last
            verified, so you can judge how current it is rather than assuming it&apos;s permanently accurate.
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Real examples from our database</h2>
        <div className="space-y-4">
          {EXAMPLE_NAMES.map((name) => {
            const c = byName.get(name);
            if (!c) return null;
            const classification = c.severityTier === 3 ? "Prohibited" : c.severityTier === 2 ? "Restricted" : "Permitted";
            const source = c.bannedInCountries || c.sourceNote || "See severity tier and category.";
            return (
              <div key={name} className="rounded-lg border border-neutral-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{name}</span>
                  <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600">
                    Tier {c.severityTier} · {TIER_LABEL[c.severityTier]}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    {classification}
                  </span>
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div>
                    <dt className="inline font-medium text-neutral-600">Source: </dt>
                    <dd className="inline text-neutral-700">{source.slice(0, 280)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-neutral-600">Date checked: </dt>
                    <dd className="inline text-neutral-700">{c.lastUpdated.toISOString().slice(0, 10)}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 border-t border-neutral-200 pt-6">
        <h2 className="font-semibold">What this app does NOT claim</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-700">
          <li>This is not medical advice, and the Chemical Safety Score is not a health or safety guarantee.</li>
          <li>
            A higher tier reflects stricter regulatory treatment elsewhere in the world (a ban, a cap, a warning
            label) — it is not an independent toxicology assessment we performed ourselves.
          </li>
          <li>
            A Tier 1 result means we found no ban, cap, or warning-label requirement in the checked
            regions — not that a substance is risk-free.
          </li>
          <li>
            Regulatory status changes. The date-checked field tells you how current an entry is; we don&apos;t
            claim continuous real-time monitoring of every regulator, in every jurisdiction, for every
            substance.
          </li>
          <li>We don&apos;t independently re-run every regulator&apos;s underlying scientific studies — we report what each has published.</li>
        </ul>
      </section>
    </article>
  );
}
