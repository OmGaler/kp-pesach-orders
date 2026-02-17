import { describe, expect, test } from "vitest";
import { buildProductSearchIndex, searchCatalog } from "@/lib/product-search";
import type { Category } from "@/types/order";

const catalog: Category[] = [
  {
    name: "PASSOVER ESSENTIALS",
    products: [
      {
        id: "charoses",
        category: "PASSOVER ESSENTIALS",
        name: "Ready Made Charoses",
        size: "250g",
        sortIndex: 0
      },
      {
        id: "chrayne",
        category: "PASSOVER ESSENTIALS",
        name: "Chrayne",
        size: null,
        sortIndex: 1
      }
    ]
  },
  {
    name: "WINE",
    products: [
      {
        id: "grape-juice",
        category: "WINE",
        name: "Grape Juice",
        size: "1L",
        sortIndex: 0
      }
    ]
  }
];

describe("product search", () => {
  test("returns fuzzy transliteration matches for charoses/chrayne terms", () => {
    const index = buildProductSearchIndex(catalog);
    const results = searchCatalog(index, "kharoses");
    const matchedNames = results.flatMap((category) => category.products.map((product) => product.name));

    expect(matchedNames).toContain("Ready Made Charoses");
  });

  test("matches partial transliterated shorthand", () => {
    const index = buildProductSearchIndex(catalog);
    const results = searchCatalog(index, "chra");
    const matchedNames = results.flatMap((category) => category.products.map((product) => product.name));

    expect(matchedNames).toContain("Chrayne");
  });

  test("returns no results for blank query", () => {
    const index = buildProductSearchIndex(catalog);
    expect(searchCatalog(index, "   ")).toEqual([]);
  });
});
