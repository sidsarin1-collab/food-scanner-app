import type { Metadata } from "next";
import ScannerForm from "@/components/ScannerForm";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "FoodPurityScanner | Scan Food Ingredients & Compare Additive Regulations",
  description:
    "Scan food ingredient labels, understand additives in plain language, compare their regulatory status across the US, EU, UK, Canada, Australia and Japan, and find alternative products.",
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
  },
  alternates: {
    canonical: `${SITE_URL}/`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "FoodPurityScanner",
  url: `${SITE_URL}/`,
  description:
    "A food ingredient scanner that explains additives and compares their regulatory status across multiple countries.",
  applicationCategory: "HealthApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Ingredient label scanning",
    "Plain-language ingredient explanations",
    "International food additive regulatory comparison",
    "Alternative food product suggestions",
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ScannerForm />
    </>
  );
}
