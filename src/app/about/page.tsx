import type { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "About FoodPurityScanner | Why We Built the Food Ingredient Scanner",
  description:
    "Why FoodPurityScanner exists: a plain-language ingredient scanner that compares food additives against regulatory records from the US, EU, UK, Canada, Australia and Japan.",
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
};

export default function AboutPage() {
  return (
    <article className="space-y-6">
      <h1 className="text-2xl font-bold">About FoodPurityScanner</h1>

      <blockquote className="border-l-4 border-neutral-300 pl-4 italic text-neutral-700">
        &ldquo;Let food be thy medicine and medicine be thy food.&rdquo; — Hippocrates
      </blockquote>

      <p className="text-neutral-700">
        I built FoodPurityScanner after finding myself in grocery aisles staring at ingredient
        labels full of names I couldn&apos;t decipher. With a background in technology, business
        transformation and problem-solving — not food chemistry — I wanted to make those labels
        easier to understand.
      </p>

      <p className="text-neutral-700">
        FoodPurityScanner lets you scan an ingredient label, explains its contents in plain
        language, and compares relevant additives with regulatory records from the United
        States, European Union, United Kingdom, Canada, Australia and Japan.
      </p>

      <p className="text-neutral-700">
        Because food regulations aren&apos;t simply &ldquo;safe&rdquo; or &ldquo;unsafe,&rdquo;
        it also shows whether ingredients are prohibited, restricted, under review or permitted
        under specific conditions.
      </p>

      <p className="text-neutral-700">
        The goal is simple: help you make more informed food choices without fear, hype or
        guesswork. It&apos;s free to use, and when possible, it also helps you find alternatives
        available where you live.
      </p>
    </article>
  );
}
