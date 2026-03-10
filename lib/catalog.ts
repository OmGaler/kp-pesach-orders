import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import type { Category, Product } from "@/types/order";

type RawCell = string | number | null | undefined;
type RawCatalogRow = [RawCell?, RawCell?, RawCell?, RawCell?, RawCell?, RawCell?];

const DEFAULT_CATALOG_FILENAME = "KP Pesach List 5786.xlsx";
const CATEGORY_PATTERN = /^[A-Z0-9 &'()\/+\-.,]+$/;
const FALLBACK_CATEGORY = "MISCELLANEOUS";
const SUBHEADING_FILL_RGB = "EAEAEA";

function cleanCell(value: RawCell): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function isHeaderRow(product: string, size: string): boolean {
  return (
    product.toLowerCase() === "product" &&
    (size.toLowerCase() === "size" || size === "")
  );
}

export function isCategoryRow(product: string, size: string): boolean {
  if (!product || size) {
    return false;
  }
  return CATEGORY_PATTERN.test(product) && product === product.toUpperCase();
}

function hasSubheadingStyle(cell?: XLSX.CellObject): boolean {
  if (!cell || typeof cell.s !== "object" || !cell.s) {
    return false;
  }
  const style = cell.s as { fgColor?: { rgb?: string } };
  const rgb = style.fgColor?.rgb?.toUpperCase();
  return rgb === SUBHEADING_FILL_RGB || rgb === `FF${SUBHEADING_FILL_RGB}`;
}

function getRowsWithSubheadingMarkers(sheet: XLSX.WorkSheet): {
  rows: RawCatalogRow[];
  subheadingRowIndexes: Set<number>;
} {
  const rows: RawCatalogRow[] = [];
  const subheadingRowIndexes = new Set<number>();
  const ref = sheet["!ref"];
  if (!ref) {
    return { rows, subheadingRowIndexes };
  }

  const range = XLSX.utils.decode_range(ref);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const productAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
    const sizeAddress = XLSX.utils.encode_cell({ r: row, c: 1 });
    const productCell = sheet[productAddress];
    const sizeCell = sheet[sizeAddress];
    const product = cleanCell(productCell?.v);
    const size = cleanCell(sizeCell?.v);
    if (!product && !size) {
      continue;
    }

    rows.push([product, size]);
    const parsedRowIndex = rows.length - 1;
    if (
      product &&
      !size &&
      !isHeaderRow(product, size) &&
      !isCategoryRow(product, size) &&
      hasSubheadingStyle(productCell)
    ) {
      subheadingRowIndexes.add(parsedRowIndex);
    }
  }

  return { rows, subheadingRowIndexes };
}

function makeProductId(category: string, name: string, size: string): string {
  const base = `${category}__${name}__${size}`.toLowerCase().replace(/\s+/g, "-");
  const digest = createHash("sha1").update(base).digest("hex").slice(0, 8);
  const safe = base.replace(/[^a-z0-9\-_]+/g, "");
  return `${safe}-${digest}`;
}

export function parseCatalogRows(
  rows: RawCatalogRow[],
  options?: { subheadingRowIndexes?: Set<number> }
): Category[] {
  const categories = new Map<string, Product[]>();
  let activeCategory = FALLBACK_CATEGORY;
  let sortIndex = 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const productCell = cleanCell(row?.[0]);
    const sizeCell = cleanCell(row?.[1]);
    if (!productCell && !sizeCell) {
      continue;
    }
    if (isHeaderRow(productCell, sizeCell)) {
      continue;
    }
    if (isCategoryRow(productCell, sizeCell)) {
      activeCategory = productCell;
      if (!categories.has(activeCategory)) {
        categories.set(activeCategory, []);
      }
      continue;
    }
    if (!productCell) {
      continue;
    }
    const isSubheading = options?.subheadingRowIndexes?.has(rowIndex) ?? false;

    if (!categories.has(activeCategory)) {
      categories.set(activeCategory, []);
    }

    const product: Product = {
      id: makeProductId(activeCategory, productCell, sizeCell),
      category: activeCategory,
      name: productCell,
      size: sizeCell || null,
      sortIndex,
      isSubheading
    };
    sortIndex += 1;
    categories.get(activeCategory)?.push(product);
  }

  return Array.from(categories.entries()).map(([name, products]) => ({
    name,
    products
  }));
}

function listCatalogCandidates(customPath?: string): string[] {
  if (customPath) {
    return [customPath];
  }

  const candidates: string[] = [];
  const dataDir = path.join(process.cwd(), "data");
  const exact = path.join(dataDir, DEFAULT_CATALOG_FILENAME);
  candidates.push(exact);

  if (!fs.existsSync(dataDir)) {
    return candidates;
  }

  const dataXlsx = fs
    .readdirSync(dataDir)
    .filter((name) => name.toLowerCase().endsWith(".xlsx"))
    .sort()
    .map((name) => path.join(dataDir, name));
  candidates.push(...dataXlsx);

  return Array.from(new Set(candidates));
}

function readWorkbookFromCandidates(candidates: string[]) {
  const errors: string[] = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }
    try {
      const bytes = fs.readFileSync(candidate);
      const workbook = XLSX.read(bytes, {
        type: "buffer",
        cellDates: false,
        raw: false,
        cellStyles: true
      });
      return workbook;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate}: ${reason}`);
    }
  }

  throw new Error(
    `Could not open any catalog workbook in /data. Tried:\n${candidates.join("\n")}\nErrors:\n${errors.join("\n")}`
  );
}

export function loadCatalogFromWorkbook(filePath?: string): Category[] {
  const workbook = readWorkbookFromCandidates(listCatalogCandidates(filePath));

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Catalog workbook does not contain any sheets");
  }
  const sheet = workbook.Sheets[firstSheetName];
  const { rows, subheadingRowIndexes } = getRowsWithSubheadingMarkers(sheet);
  return parseCatalogRows(rows, { subheadingRowIndexes });
}

declare global {
  // eslint-disable-next-line no-var
  var __kpCatalogCache: Category[] | undefined;
}

export function getCatalog(): Category[] {
  if (!global.__kpCatalogCache) {
    global.__kpCatalogCache = loadCatalogFromWorkbook();
  }
  return global.__kpCatalogCache;
}

export function buildProductIndex(catalog: Category[]): Map<string, Product> {
  const index = new Map<string, Product>();
  for (const category of catalog) {
    for (const product of category.products) {
      if (product.isSubheading) {
        continue;
      }
      index.set(product.id, product);
    }
  }
  return index;
}
