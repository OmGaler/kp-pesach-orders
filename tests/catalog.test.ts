import { describe, expect, test } from "vitest";
import { buildProductIndex, isCategoryRow, parseCatalogRows } from "@/lib/catalog";

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

  test("marks subheading rows while keeping their position in category output", () => {
    const rows = [
      ["Product", "Size"],
      ["NUTS", ""],
      ["Raw Nuts", ""],
      ["Almonds", "200g"],
      ["Roasted Salted", ""],
      ["Cashews", "180g"]
    ] as Array<[string, string]>;

    const parsed = parseCatalogRows(rows, { subheadingRowIndexes: new Set([2, 4]) });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("NUTS");
    expect(parsed[0]?.products.map((product) => product.name)).toEqual([
      "Raw Nuts",
      "Almonds",
      "Roasted Salted",
      "Cashews"
    ]);
    expect(parsed[0]?.products[0]?.isSubheading).toBe(true);
    expect(parsed[0]?.products[2]?.isSubheading).toBe(true);
    expect(parsed[0]?.products[1]?.isSubheading).toBe(false);
    expect(parsed[0]?.products[3]?.isSubheading).toBe(false);
  });

  test("keeps no-size product rows when they are not section subheadings", () => {
    const rows = [
      ["Product", "Size"],
      ["SPICES", ""],
      ["Whole Cloves", ""],
      ["Ground Cinnamon", ""]
    ] as Array<[string, string]>;

    const parsed = parseCatalogRows(rows);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("SPICES");
    expect(parsed[0]?.products.map((product) => product.name)).toEqual([
      "Whole Cloves",
      "Ground Cinnamon"
    ]);
    expect(parsed[0]?.products[0]?.size).toBeNull();
    expect(parsed[0]?.products[1]?.size).toBeNull();
  });

  test("excludes subheading rows from orderable product index", () => {
    const rows = [
      ["NUTS", ""],
      ["Raw Nuts", ""],
      ["Almonds", "200g"]
    ] as Array<[string, string]>;
    const parsed = parseCatalogRows(rows, { subheadingRowIndexes: new Set([1]) });
    const index = buildProductIndex(parsed);

    const names = Array.from(index.values()).map((product) => product.name);
    expect(names).toEqual(["Almonds"]);
  });
});
