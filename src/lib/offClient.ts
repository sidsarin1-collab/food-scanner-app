const USER_AGENT = "IngredientSafetyScanner/1.0 (contact: sid.sarin1@gmail.com)";
const BASE_URL = "https://world.openfoodfacts.org";

export type OffProduct = {
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  code?: string;
  categories_tags?: string[];
  countries_tags?: string[];
  nutrition_grades?: string;
  nova_group?: number;
};

type CacheEntry = { data: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function offFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const cacheKey = url.toString();

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Open Food Facts occasionally returns a transient 503 under load; one retry
  // clears most of them without making the caller wait too long on a real failure.
  let res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok && res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } });
  }
  if (!res.ok) {
    throw new Error(`Open Food Facts request failed: ${res.status}`);
  }
  const data = await res.json();
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

/** Searches Open Food Facts by product name to find likely category tags for it. */
export async function searchProductsByName(name: string): Promise<OffProduct[]> {
  const data = (await offFetch("/cgi/search.pl", {
    search_terms: name,
    json: "1",
    page_size: "5",
    fields: "product_name,brands,categories_tags,code",
  })) as { products?: OffProduct[] };
  return data.products ?? [];
}

/** Searches Open Food Facts for products in a given category + country. */
export async function searchProductsByCategoryAndCountry(
  categoryTag: string,
  countryTag: string
): Promise<OffProduct[]> {
  const data = (await offFetch("/cgi/search.pl", {
    action: "process",
    json: "1",
    page_size: "50",
    tagtype_0: "categories",
    tag_contains_0: "contains",
    tag_0: categoryTag,
    tagtype_1: "countries",
    tag_contains_1: "contains",
    tag_1: countryTag,
    fields: "product_name,brands,ingredients_text,code,categories_tags,countries_tags,nutrition_grades,nova_group",
  })) as { products?: OffProduct[] };
  return data.products ?? [];
}
