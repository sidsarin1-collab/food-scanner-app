export type Country = {
  label: string;
  /** Open Food Facts country taxonomy tag (canonical "en:" form). */
  offTag: string;
};

// Countries with reasonable Open Food Facts contributor coverage. Kept short
// deliberately -- outside these, "limited local data" will trigger often,
// which is the intended, honest behavior rather than forcing weak matches.
export const COUNTRIES: Country[] = [
  { label: "United States", offTag: "en:united-states" },
  { label: "United Kingdom", offTag: "en:united-kingdom" },
  { label: "Canada", offTag: "en:canada" },
  { label: "Australia", offTag: "en:australia" },
  { label: "Germany", offTag: "en:germany" },
  { label: "France", offTag: "en:france" },
  { label: "India", offTag: "en:india" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function findCountryByOffTag(offTag: string): Country | undefined {
  return COUNTRIES.find((c) => c.offTag === offTag);
}
