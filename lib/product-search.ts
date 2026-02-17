import type { Category, Product } from "@/types/order";

interface IndexedProduct {
  categoryName: string;
  product: Product;
  haystack: string;
  tokens: string[];
  tokenSkeletons: string[];
}

export interface ProductSearchIndex {
  entries: IndexedProduct[];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function foldForSearch(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const folded = normalized
    .replace(/['’`"]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/ch|kh/g, "h")
    .replace(/ph/g, "f")
    .replace(/tz|ts/g, "z")
    .replace(/aa|ah/g, "a")
    .replace(/ee|ei|ey/g, "i")
    .replace(/oo|ou/g, "u")
    .replace(/oi|oy/g, "i")
    .replace(/w/g, "v")
    .replace(/q/g, "k");

  return normalizeWhitespace(folded);
}

function toSkeleton(value: string): string {
  return value.replace(/[aeiou]/g, "").replace(/\s+/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function makeHaystack(product: Product): string {
  return foldForSearch([product.name, product.size ?? ""].join(" "));
}

function scoreEntry(entry: IndexedProduct, query: string): number {
  const queryTokens = query.split(" ").filter(Boolean);
  if (!queryTokens.length) {
    return 0;
  }

  const querySkeleton = toSkeleton(query);
  let score = 0;

  const exactIndex = entry.haystack.indexOf(query);
  if (exactIndex >= 0) {
    score += 200 - Math.min(exactIndex, 100);
  }

  if (querySkeleton.length >= 3) {
    if (entry.tokenSkeletons.some((token) => token.includes(querySkeleton))) {
      score += 65;
    }
  }

  for (const queryToken of queryTokens) {
    let tokenScore = 0;
    for (const token of entry.tokens) {
      if (token === queryToken) {
        tokenScore = Math.max(tokenScore, 80);
        continue;
      }
      if (token.startsWith(queryToken)) {
        tokenScore = Math.max(tokenScore, 55);
        continue;
      }
      if (token.includes(queryToken)) {
        tokenScore = Math.max(tokenScore, 38);
        continue;
      }

      const distance = levenshtein(queryToken, token);
      const limit = Math.max(1, Math.floor(queryToken.length / 3));
      if (distance <= limit) {
        tokenScore = Math.max(tokenScore, 32 - distance * 8);
      }
    }
    score += tokenScore;
  }

  return score;
}

export function buildProductSearchIndex(catalog: Category[]): ProductSearchIndex {
  const entries: IndexedProduct[] = [];
  for (const category of catalog) {
    for (const product of category.products) {
      const haystack = makeHaystack(product);
      entries.push({
        categoryName: category.name,
        product,
        haystack,
        tokens: haystack.split(" ").filter(Boolean),
        tokenSkeletons: haystack.split(" ").map(toSkeleton).filter(Boolean)
      });
    }
  }
  return { entries };
}

export function searchCatalog(index: ProductSearchIndex, rawQuery: string): Category[] {
  const query = foldForSearch(rawQuery);
  if (!query) {
    return [];
  }

  const byCategory = new Map<string, Array<{ product: Product; score: number }>>();

  for (const entry of index.entries) {
    const score = scoreEntry(entry, query);
    if (score <= 0) {
      continue;
    }
    const current = byCategory.get(entry.categoryName) ?? [];
    current.push({ product: entry.product, score });
    byCategory.set(entry.categoryName, current);
  }

  return Array.from(byCategory.entries())
    .map(([name, scored]) => ({
      name,
      products: scored
        .sort((a, b) => b.score - a.score || a.product.sortIndex - b.product.sortIndex)
        .map((item) => item.product)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
