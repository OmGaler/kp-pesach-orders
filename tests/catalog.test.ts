import { describe, expect, test } from "vitest";
import { isCategoryRow, parseCatalogRows } from "@/lib/catalog";

describe("catalog parsing", () => {
  test("detects category rows", () => {
    expect(isCategoryRow("PASSOVER ESSENTIALS", "")).toBe(true);
    expect(isCategoryRow("Passover Essentials", "")).toBe(false);
    expect(isCategoryRow("PASSOVER ESSENTIALS", "250g")).toBe(false);
  });

  test("groups products under category and trims values", () => {
    const rows = [
      ["Product", "Size"],
      ["PASSOVER ESSENTIALS", ""],
      ["Ready Made Charoses ", "250g "],
      ["Grated Horseradish", "140g"],
      ["", ""],
      ["MATZO PRODUCTS", ""],
      ["Hand Matzos", "1kg"]
    ] as Array<[string, string]>;

    const parsed = parseCatalogRows(rows);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.name).toBe("PASSOVER ESSENTIALS");
    expect(parsed[0]?.products).toHaveLength(2);
    expect(parsed[0]?.products[0]?.name).toBe("Ready Made Charoses");
    expect(parsed[0]?.products[0]?.size).toBe("250g");
    expect(parsed[1]?.name).toBe("MATZO PRODUCTS");
    expect(parsed[1]?.products).toHaveLength(1);
  });
});
