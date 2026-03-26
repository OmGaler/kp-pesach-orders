const fs = require("node:fs");
const path = require("node:path");
const { google } = require("googleapis");
const XLSX = require("xlsx");
const {
  buildSalesAnalysis,
  buildCategoryLookup,
  isOrderDetailSheetTitle,
  parseOrderSheetValues
} = require("../lib/sales-analysis");

const DEFAULT_CATALOG_FILENAME = "KP Pesach List 5786.xlsx";
const CATEGORY_PATTERN = /^[A-Z0-9 &'()\/+\-.,]+$/;
const SUBHEADING_FILL_RGB = "EAEAEA";
const DEFAULT_DASHBOARD_TITLE = "Sheet1";
const COMMON_DASHBOARD_TITLES = ["Orders", "Contents", DEFAULT_DASHBOARD_TITLE];

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normaliseCell(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function isCategoryRow(product, size) {
  if (!product || size) {
    return false;
  }

  return CATEGORY_PATTERN.test(product) && product === product.toUpperCase();
}

function hasSubheadingStyle(cell) {
  if (!cell || typeof cell.s !== "object" || !cell.s) {
    return false;
  }

  const rgb = cell.s.fgColor?.rgb?.toUpperCase();
  return rgb === SUBHEADING_FILL_RGB || rgb === `FF${SUBHEADING_FILL_RGB}`;
}

function loadCatalogMetadata(projectRoot) {
  const catalogPath = path.join(projectRoot, "data", DEFAULT_CATALOG_FILENAME);
  if (!fs.existsSync(catalogPath)) {
    return new Map();
  }

  const workbook = XLSX.read(fs.readFileSync(catalogPath), {
    type: "buffer",
    cellStyles: true,
    raw: false
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return new Map();
  }

  const sheet = workbook.Sheets[firstSheetName];
  const ref = sheet["!ref"];
  if (!ref) {
    return new Map();
  }

  const categories = [];
  const range = XLSX.utils.decode_range(ref);
  let activeCategory = "Unmatched";
  let activeProducts = [];

  function ensureActiveCategory(categoryName) {
    const existing = categories.find((category) => category.name === categoryName);
    if (existing) {
      activeProducts = existing.products;
      return;
    }

    activeProducts = [];
    categories.push({
      name: categoryName,
      products: activeProducts
    });
  }

  ensureActiveCategory(activeCategory);

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const productCell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: 0 })];
    const sizeCell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: 1 })];
    const product = normaliseCell(productCell?.v);
    const size = normaliseCell(sizeCell?.v);

    if (!product && !size) {
      continue;
    }

    if (
      product.toLowerCase() === "product" &&
      (size.toLowerCase() === "size" || size === "")
    ) {
      continue;
    }

    if (isCategoryRow(product, size)) {
      activeCategory = product;
      ensureActiveCategory(activeCategory);
      continue;
    }

    activeProducts.push({
      category: activeCategory,
      name: product,
      size: size || null,
      isSubheading: Boolean(product && !size && hasSubheadingStyle(productCell))
    });
  }

  return buildCategoryLookup(categories);
}

function normaliseSheetTitle(title) {
  return normaliseCell(title).toLowerCase();
}

function findSheetByTitle(knownSheets, title) {
  const expected = normaliseSheetTitle(title);
  return knownSheets.find((sheet) => normaliseSheetTitle(sheet.title) === expected);
}

function selectDashboardSheetTitle(knownSheets, configuredTitle = process.env.GOOGLE_SHEET_DASHBOARD_TAB?.trim()) {
  if (configuredTitle) {
    const configuredSheet = findSheetByTitle(knownSheets, configuredTitle);
    if (configuredSheet) {
      return configuredSheet.title;
    }
  }

  for (const commonTitle of COMMON_DASHBOARD_TITLES) {
    const matchingSheet = findSheetByTitle(knownSheets, commonTitle);
    if (matchingSheet) {
      return matchingSheet.title;
    }
  }

  const firstNonOrderSheet = knownSheets.find(
    (sheet) => !isOrderDetailSheetTitle(sheet.title)
  );

  return firstNonOrderSheet?.title ?? knownSheets[0]?.title ?? null;
}

function buildStatusLookup(dashboardRows) {
  const statusLookup = new Map();

  for (const row of dashboardRows.slice(1)) {
    const orderId = normaliseCell(row[0]);
    if (!orderId) {
      continue;
    }

    statusLookup.set(orderId, normaliseCell(row[4]) || "Not started");
  }

  return statusLookup;
}

function normalisePrivateKey(rawPrivateKey) {
  let value = rawPrivateKey.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  value = value.replace(/\\n/g, "\n");

  if (value.includes("-----BEGIN PRIVATE KEY-----")) {
    return value;
  }

  const decoded = Buffer.from(value, "base64").toString("utf8");
  if (decoded.includes("-----BEGIN PRIVATE KEY-----")) {
    return decoded;
  }

  throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY format.");
}

function quoteSheetTitle(title) {
  return `'${title.replace(/'/g, "''")}'`;
}

function escapeCsvValue(value) {
  const stringValue = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, "", "utf8");
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","))
  ];

  fs.writeFileSync(filePath, `${csvRows.join("\n")}\n`, "utf8");
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  loadEnvFile(path.join(projectRoot, ".env.local"));

  const spreadsheetId = requireEnv("GOOGLE_SHEET_ID");
  const serviceEmail = requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = normalisePrivateKey(requireEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"));

  const auth = new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({
    version: "v4",
    auth
  });

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title"
  });

  const knownSheets = (spreadsheet.data.sheets ?? [])
    .map((sheet) => ({ title: sheet.properties?.title ?? "" }))
    .filter((sheet) => sheet.title);
  const orderSheetTitles = knownSheets
    .map((sheet) => sheet.title)
    .filter(isOrderDetailSheetTitle);
  const dashboardTitle = selectDashboardSheetTitle(knownSheets);

  if (!orderSheetTitles.length) {
    throw new Error("No order detail sheets were found in the workbook.");
  }

  if (!dashboardTitle) {
    throw new Error("Could not determine the dashboard sheet.");
  }

  const valuesResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      `${quoteSheetTitle(dashboardTitle)}!A:M`,
      ...orderSheetTitles.map((title) => `${quoteSheetTitle(title)}!A:D`)
    ]
  });

  const valueRanges = valuesResponse.data.valueRanges ?? [];
  const dashboardRows = valueRanges[0]?.values ?? [];
  const statusLookup = buildStatusLookup(dashboardRows);
  const orders = valueRanges.slice(1).map((valueRange, index) => {
    const parsedOrder = parseOrderSheetValues(orderSheetTitles[index], valueRange.values ?? []);
    return {
      ...parsedOrder,
      status: statusLookup.get(parsedOrder.orderId) || "Unknown"
    };
  });

  const metadataLookup = loadCatalogMetadata(projectRoot);
  const analysis = buildSalesAnalysis(orders, metadataLookup);
  const outputDir = path.join(projectRoot, "notebooks", "data");
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, "sales-analysis.json"),
    `${JSON.stringify(analysis, null, 2)}\n`,
    "utf8"
  );
  writeCsv(path.join(outputDir, "orders.csv"), analysis.orders);
  writeCsv(path.join(outputDir, "product-totals.csv"), analysis.productTotals);
  writeCsv(path.join(outputDir, "unfulfilled-product-totals.csv"), analysis.unfulfilledProductTotals);
  writeCsv(path.join(outputDir, "category-totals.csv"), analysis.categoryTotals);
  writeCsv(path.join(outputDir, "subcategory-totals.csv"), analysis.subcategoryTotals);
  writeCsv(path.join(outputDir, "product-type-totals.csv"), analysis.productTypeTotals);
  writeCsv(path.join(outputDir, "product-type-size-mix.csv"), analysis.productTypeSizeMix);
  writeCsv(path.join(outputDir, "delivery-date-totals.csv"), analysis.deliveryDateTotals);
  writeCsv(path.join(outputDir, "unmatched-products.csv"), analysis.unmatchedProducts);

  console.log(
    `Exported ${analysis.summary.orderCount} orders across ${analysis.summary.uniqueProducts} products to ${outputDir}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
