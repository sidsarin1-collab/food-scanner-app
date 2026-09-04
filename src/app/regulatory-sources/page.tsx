import type { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Regulatory Sources | FoodPurityScanner",
  description:
    "The six food-safety regulatory bodies FoodPurityScanner checks against: FDA, EFSA, UK FSA, Health Canada, FSANZ and Japan's MHLW.",
  alternates: {
    canonical: `${SITE_URL}/regulatory-sources`,
  },
};

const SOURCES = [
  {
    name: "FDA",
    full: "U.S. Food and Drug Administration",
    description:
      "Regulates food additive approvals in the United States, including the GRAS (Generally Recognized as Safe) list.",
    role:
      "Used as the baseline comparison point: a Tier 3 (\"Ugly\") flag specifically means a substance is banned outright in one of the other five regions below while the FDA still permits it in the US.",
  },
  {
    name: "EFSA",
    full: "European Food Safety Authority",
    description:
      "The EU's independent scientific body for food-safety risk assessment, including re-evaluations of existing additives.",
    role:
      "Its opinions and re-evaluations underpin most EU-wide bans, usage caps, and maximum-permitted-level rules checked for Tier 2 (restricted/capped) and Tier 3 (banned) classification.",
  },
  {
    name: "UK FSA",
    full: "Food Standards Agency (United Kingdom)",
    description: "The UK's independent food safety regulator.",
    role:
      "Checked separately from the EU, since UK rules have diverged from EU rules post-Brexit on some substances (e.g. titanium dioxide) — confirms whether a ban or restriction actually applies in the UK specifically, not just assumed from the EU position.",
  },
  {
    name: "Health Canada",
    full: "Health Canada",
    description: "Canada's federal department responsible for food safety regulation.",
    role:
      "Source for Canadian bans and restrictions used in the tiering rule (e.g. the 2018 outright ban on partially hydrogenated oils).",
  },
  {
    name: "FSANZ",
    full: "Food Standards Australia New Zealand",
    description: "Develops and maintains the Australia New Zealand Food Standards Code.",
    role: "Source for Australian bans, restrictions, and maximum permitted levels checked in the tiering rule.",
  },
  {
    name: "Japan MHLW",
    full: "Ministry of Health, Labour and Welfare (Japan)",
    description: "Maintains Japan's positive list of food additives permitted for use.",
    role:
      "Japan operates a positive-list system — a substance absent from that list is functionally banned there. Checked to catch bans and restrictions the other five sources wouldn't surface (e.g. TBHQ, not on Japan's approved list).",
  },
];

export default function RegulatorySourcesPage() {
  return (
    <article className="space-y-6">
      <h1 className="text-2xl font-bold">Regulatory Sources</h1>
      <p className="text-neutral-700">
        FoodPurityScanner checks each additive against the regulatory record in six jurisdictions. A substance
        banned outright in any one of these five non-US regions is flagged as Tier 3 (&ldquo;Ugly&rdquo;), even
        when the FDA still permits it in the United States.
      </p>

      <div className="space-y-5">
        {SOURCES.map((s) => (
          <div key={s.name} className="rounded-lg border border-neutral-200 p-4">
            <h2 className="font-semibold">
              {s.name} <span className="font-normal text-neutral-500">— {s.full}</span>
            </h2>
            <p className="mt-1 text-sm text-neutral-700">{s.description}</p>
            <p className="mt-2 text-sm text-neutral-500">
              <span className="font-medium text-neutral-600">Role in tiering: </span>
              {s.role}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
