export type Category = {
  label: string;
  /** Open Food Facts category taxonomy tag (canonical "en:" form). */
  offTag: string;
};

// A curated subset of Open Food Facts' category taxonomy covering common
// packaged foods -- not exhaustive, but keeps auto-detection and the manual
// fallback dropdown constrained to categories we know have real OFF coverage.
export const CATEGORIES: Category[] = [
  { label: "Bread", offTag: "en:breads" },
  { label: "Breakfast cereals", offTag: "en:breakfast-cereals" },
  { label: "Soda / carbonated drinks", offTag: "en:sodas" },
  { label: "Yogurt", offTag: "en:yogurts" },
  { label: "Cookies", offTag: "en:biscuits" },
  { label: "Crackers", offTag: "en:crackers" },
  { label: "Candy", offTag: "en:candies" },
  { label: "Ice cream", offTag: "en:ice-creams" },
  { label: "Potato chips / salty snacks", offTag: "en:crisps" },
  { label: "Cheese", offTag: "en:cheeses" },
  { label: "Pasta", offTag: "en:pastas" },
  { label: "Peanut butter", offTag: "en:peanut-butters" },
  { label: "Ketchup & condiments", offTag: "en:condiments" },
  { label: "Salad dressing", offTag: "en:dressings" },
  { label: "Fruit juice", offTag: "en:fruit-juices" },
  { label: "Frozen meals", offTag: "en:frozen-foods" },
  { label: "Canned soup", offTag: "en:soups" },
  { label: "Granola / cereal bars", offTag: "en:cereal-bars" },
];

export function findCategoryByOffTag(offTag: string): Category | undefined {
  return CATEGORIES.find((c) => c.offTag === offTag);
}
