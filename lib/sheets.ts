import { google } from "googleapis";
import { requireEnv } from "@/lib/env";
import type { NormalizedOrder } from "@/types/order";

const DEFAULT_DASHBOARD_TITLE = "Sheet1";
const DASHBOARD_HEADERS = [
  "Order ID",
  "Created At",
  "Customer Name",
  "Delivery Date",
  "Status",
  "Delivery Slot",
  "Allow Kitniyot",
  "Allow Substitutes",
  "Total Items",
  "Phone Number",
  "Address",
  "Notes",
  "Order Details"
];

interface SpreadsheetSheet {
  sheetId: number;
  title: string;
  rowCount?: number;
}

interface GoogleApiErrorShape {
  message?: string;
  response?: {
    status?: number;
    data?: {
      error?: {
        message?: string;
      };
    };
  };
}

function dashboardTabTitle(): string {
  const configuredTitle = process.env.GOOGLE_SHEET_DASHBOARD_TAB?.trim();
  return configuredTitle || DEFAULT_DASHBOARD_TITLE;
}

function normalizePrivateKey(rawPrivateKey: string): string {
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

  throw new Error(
    "Invalid GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY format. Use the full PEM private key from the Google service-account JSON."
  );
}

function formatSheetsError(
  error: unknown,
  spreadsheetId: string,
  serviceEmail: string
): Error {
  const apiError = error as GoogleApiErrorShape;
  const status = apiError.response?.status;
  const apiMessage = apiError.response?.data?.error?.message;
  const message = apiMessage ?? apiError.message ?? "Unknown Google Sheets error";

  if (status === 403) {
    return new Error(
      `Permission denied for spreadsheet ${spreadsheetId}. Share it with ${serviceEmail} as Editor in Google Sheets.`
    );
  }

  return new Error(message);
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function makeRange(title: string, a1Range: string): string {
  return `${quoteSheetTitle(title)}!${a1Range}`;
}

function sanitizeSheetTitle(title: string): string {
  const sanitized = title
    .replace(/[:\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) {
    return "Order";
  }

  return sanitized.slice(0, 100);
}

function makeUniqueSheetTitle(baseTitle: string, existingTitles: Set<string>): string {
  if (!existingTitles.has(baseTitle)) {
    return baseTitle;
  }

  let suffix = 2;
  while (true) {
    const suffixLabel = ` (${suffix})`;
    const maxBaseLength = Math.max(1, 100 - suffixLabel.length);
    const candidate = `${baseTitle.slice(0, maxBaseLength).trimEnd()}${suffixLabel}`;
    if (!existingTitles.has(candidate)) {
      return candidate;
    }
    suffix += 1;
  }
}

function listSheets(spreadsheetData: { sheets?: Array<{ properties?: { sheetId?: number | null; title?: string | null; gridProperties?: { rowCount?: number | null } | null } | null }> | null }): SpreadsheetSheet[] {
  return (spreadsheetData.sheets ?? [])
    .map((sheet): SpreadsheetSheet | null => {
      const sheetId = sheet.properties?.sheetId;
      const title = sheet.properties?.title;
      if (sheetId === undefined || sheetId === null || !title) {
        return null;
      }
      return {
        sheetId,
        title,
        rowCount: sheet.properties?.gridProperties?.rowCount ?? undefined
      };
    })
    .filter((sheet): sheet is SpreadsheetSheet => sheet !== null);
}

function addressForOrder(order: NormalizedOrder): string {
  return [order.addressLine1, order.addressLine2, order.postcode].filter(Boolean).join(", ");
}

function formatSheetsDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function totalQuantity(order: NormalizedOrder): number {
  return order.items.reduce((total, item) => total + item.qty, 0);
}

async function getSpreadsheetSheets(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<SpreadsheetSheet[]> {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.sheetId,sheets.properties.title,sheets.properties.gridProperties.rowCount"
  });

  return listSheets(spreadsheet.data);
}

async function ensureDashboardSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  knownSheets: SpreadsheetSheet[]
): Promise<SpreadsheetSheet> {
  const configuredTitle = dashboardTabTitle();
  const configuredSheet = knownSheets.find((sheet) => sheet.title === configuredTitle);
  if (configuredSheet) {
    return configuredSheet;
  }

  const sheet1 = knownSheets.find((sheet) => sheet.title === "Sheet1");
  if (sheet1) {
    return sheet1;
  }

  const firstSheet = knownSheets[0];
  if (firstSheet) {
    return firstSheet;
  }

  const createResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: configuredTitle,
              gridProperties: {
                rowCount: 1000,
                columnCount: DASHBOARD_HEADERS.length
              }
            }
          }
        }
      ]
    }
  });

  const newSheetId = createResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (newSheetId === undefined || newSheetId === null) {
    throw new Error("Failed to create dashboard sheet");
  }

  return {
    sheetId: newSheetId,
    title: configuredTitle,
    rowCount: 1000
  };
}

async function configureDashboardSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  dashboard: SpreadsheetSheet
): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: makeRange(dashboard.title, "A1:M1"),
    valueInputOption: "RAW",
    requestBody: {
      values: [DASHBOARD_HEADERS]
    }
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: dashboard.sheetId,
              gridProperties: {
                frozenRowCount: 1
              }
            },
            fields: "gridProperties.frozenRowCount"
          }
        },
      ]
    }
  });
}

async function createOrderDetailSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  order: NormalizedOrder,
  existingSheetTitles: Set<string>
): Promise<SpreadsheetSheet> {
  const desiredTitle = sanitizeSheetTitle(`Order ${order.orderRef}`);
  const detailTitle = makeUniqueSheetTitle(desiredTitle, existingSheetTitles);

  const createResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: detailTitle,
              gridProperties: {
                rowCount: 250,
                columnCount: 6
              }
            }
          }
        }
      ]
    }
  });

  const detailSheetId = createResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (detailSheetId === undefined || detailSheetId === null) {
    throw new Error("Failed to create order detail sheet");
  }

  const address = addressForOrder(order);
  const uniqueItems = order.items.length;
  const totalQty = totalQuantity(order);
  const createdAtDisplay = formatSheetsDateTime(order.createdAtIso);

  const summaryRows = [
    ["Order Summary", ""],
    ["Order ID", order.orderRef],
    ["Created At", createdAtDisplay],
    ["Customer Name", order.customerName],
    ["Delivery Date", order.deliveryDate],
    ["Delivery Slot", order.deliverySlot],
    ["Allow Kitniyot", order.allowKitniyot ? "Yes" : "No"],
    ["Allow Substitutes", order.allowSubstitutes ? "Yes" : "No"],
    ["Phone", order.phone],
    ["Email", order.email ?? ""],
    ["Address", address],
    ["Notes", order.notes ?? ""],
    ["Unique Items", String(uniqueItems)],
    ["Total Quantity", String(totalQty)]
  ];
  const itemTableStartRow = summaryRows.length + 2;
  const itemHeaderZeroBasedRow = itemTableStartRow - 1;

  const itemRows = [
    ["Item #", "Item Name", "Size", "Quantity"],
    ...order.items.map((item, index) => [
      String(index + 1),
      item.name,
      item.size ?? "",
      String(item.qty)
    ])
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: makeRange(detailTitle, "A1"),
          values: summaryRows
        },
        {
          range: makeRange(detailTitle, `A${itemTableStartRow}`),
          values: itemRows
        }
      ]
    }
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: detailSheetId,
              gridProperties: {
                frozenRowCount: itemTableStartRow
              }
            },
            fields: "gridProperties.frozenRowCount"
          }
        },
        {
          repeatCell: {
            range: {
              sheetId: detailSheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 2
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  bold: true
                }
              }
            },
            fields: "userEnteredFormat.textFormat.bold"
          }
        },
        {
          repeatCell: {
            range: {
              sheetId: detailSheetId,
              startRowIndex: itemHeaderZeroBasedRow,
              endRowIndex: itemHeaderZeroBasedRow + 1,
              startColumnIndex: 0,
              endColumnIndex: 4
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  bold: true
                },
                backgroundColorStyle: {
                  rgbColor: {
                    red: 0.89,
                    green: 0.94,
                    blue: 0.91
                  }
                }
              }
            },
            fields: "userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColorStyle"
          }
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: detailSheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: 4
            }
          }
        }
      ]
    }
  });

  return {
    sheetId: detailSheetId,
    title: detailTitle
  };
}

async function appendOrderToDashboard(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  dashboard: SpreadsheetSheet,
  order: NormalizedOrder,
  detailSheet: SpreadsheetSheet
): Promise<void> {
  const totalQty = totalQuantity(order);
  const address = addressForOrder(order);
  const createdAtDisplay = formatSheetsDateTime(order.createdAtIso);
  const detailLink = `=HYPERLINK("#gid=${detailSheet.sheetId}", "Open")`;
  const columnA = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: makeRange(dashboard.title, "A:A")
  });
  const nextRow = (columnA.data.values?.length ?? 0) + 1;
  const currentRowCount = dashboard.rowCount ?? 0;
  if (nextRow > currentRowCount) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: dashboard.sheetId,
                gridProperties: {
                  rowCount: Math.max(nextRow + 200, currentRowCount + 200, 1000)
                }
              },
              fields: "gridProperties.rowCount"
            }
          }
        ]
      }
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: makeRange(dashboard.title, `A${nextRow}:M${nextRow}`),
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          order.orderRef,
          createdAtDisplay,
          order.customerName,
          order.deliveryDate,
          "Not started",
          order.deliverySlot,
          order.allowKitniyot,
          order.allowSubstitutes,
          totalQty,
          order.phone,
          address,
          order.notes ?? "",
          detailLink
        ]
      ]
    }
  });
}

export async function appendOrderToSheet(order: NormalizedOrder): Promise<void> {
  const serviceEmail = requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const rawPrivateKey = requireEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  const spreadsheetId = requireEnv("GOOGLE_SHEET_ID");
  const privateKey = normalizePrivateKey(rawPrivateKey);

  const auth = new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({
    version: "v4",
    auth
  });

  try {
    const knownSheets = await getSpreadsheetSheets(sheets, spreadsheetId);
    const dashboard = await ensureDashboardSheet(sheets, spreadsheetId, knownSheets);
    const existingTitles = new Set(knownSheets.map((sheet) => sheet.title));
    existingTitles.add(dashboard.title);

    await configureDashboardSheet(sheets, spreadsheetId, dashboard);
    const detailSheet = await createOrderDetailSheet(sheets, spreadsheetId, order, existingTitles);
    await appendOrderToDashboard(sheets, spreadsheetId, dashboard, order, detailSheet);
  } catch (error) {
    throw formatSheetsError(error, spreadsheetId, serviceEmail);
  }
}
