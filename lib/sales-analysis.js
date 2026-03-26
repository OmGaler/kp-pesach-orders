function normaliseCell(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normaliseStatus(status) {
  return normaliseCell(status).toLowerCase();
}

function normaliseProductKey(name) {
  return normaliseCell(name).toLowerCase();
}

function normaliseProductSizeKey(name, size) {
  return `${normaliseCell(name).toLowerCase()}|||${normaliseCell(size).toLowerCase()}`;
}

function titleCase(value) {
  return normaliseCell(value)
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isOrderDetailSheetTitle(title) {
  return /^order\b/i.test(normaliseCell(title));
}

function parseQuantity(value, context = "") {
  const raw = normaliseCell(value);
  if (!raw) {
    return 0;
  }

  const quantity = Number(raw);
  if (!Number.isFinite(quantity)) {
    throw new Error(`Invalid quantity value${context ? ` in ${context}` : ""}: ${raw}`);
  }

  return quantity;
}

function findItemHeaderRowIndex(rows) {
  return rows.findIndex((row) => {
    return (
      normaliseCell(row[0]) === "Item #" &&
      normaliseCell(row[1]) === "Item Name" &&
      normaliseCell(row[2]) === "Size" &&
      normaliseCell(row[3]) === "Quantity"
    );
  });
}

function parseSummary(rows, itemHeaderRowIndex) {
  const summary = {};
  const summaryRows = itemHeaderRowIndex === -1 ? rows : rows.slice(0, itemHeaderRowIndex);

  for (const row of summaryRows) {
    const label = normaliseCell(row[0]);
    if (!label || label === "Order Summary") {
      continue;
    }

    summary[label] = normaliseCell(row[1]);
  }

  return summary;
}

function parseItemRows(rows, itemHeaderRowIndex, sheetTitle) {
  if (itemHeaderRowIndex === -1) {
    throw new Error(`Could not find item table in sheet "${sheetTitle}"`);
  }

  const items = [];
  for (const [index, row] of rows.slice(itemHeaderRowIndex + 1).entries()) {
    const itemName = normaliseCell(row[1]);
    const size = normaliseCell(row[2]);
    const quantityCell = normaliseCell(row[3]);

    if (!itemName && !size && !quantityCell) {
      continue;
    }

    items.push({
      name: itemName,
      size,
      quantity: parseQuantity(
        quantityCell,
        `sheet "${sheetTitle}" row ${itemHeaderRowIndex + index + 2}`
      )
    });
  }

  return items.filter((item) => item.name && item.quantity > 0);
}

function parseOrderSheetValues(sheetTitle, rows) {
  const itemHeaderRowIndex = findItemHeaderRowIndex(rows);
  const summary = parseSummary(rows, itemHeaderRowIndex);
  const items = parseItemRows(rows, itemHeaderRowIndex, sheetTitle);

  return {
    sheetTitle,
    orderId: summary["Order ID"] || sheetTitle.replace(/^order\s+/i, "").trim(),
    createdAt: summary["Created At"] || "",
    customerName: summary["Customer Name"] || "",
    deliveryDate: summary["Delivery Date"] || "",
    deliverySlot: summary["Delivery Slot"] || "",
    allowKitniyot: summary["Allow Kitniyot"] || "",
    allowSubstitutes: summary["Allow Substitutes"] || "",
    phone: summary["Phone"] || "",
    email: summary["Email"] || "",
    address: summary["Address"] || "",
    notes: summary["Notes"] || "",
    items
  };
}

function calculatePct(part, whole) {
  if (!whole) {
    return 0;
  }

  return Number(((part / whole) * 100).toFixed(2));
}

function sortByQuantityDesc(left, right) {
  if (right.totalQuantity !== left.totalQuantity) {
    return right.totalQuantity - left.totalQuantity;
  }

  return normaliseCell(left.name || left.category || left.productType).localeCompare(
    normaliseCell(right.name || right.category || right.productType)
  );
}

function inferProductType(name, metadata = {}) {
  if (metadata.subcategory && isFamilyLikeLabel(metadata.subcategory)) {
    return metadata.subcategory;
  }

  const lowerName = normaliseCell(name).toLowerCase();
  const exactPatterns = [
    [/smoked\s+salmon/, "Smoked Salmon"],
    [/grape\s+juice/, "Grape Juice"],
    [/apple\s+juice/, "Apple Juice"],
    [/orange\s+juice/, "Orange Juice"],
    [/mustard/, "Mustard"],
    [/mayonnaise|\bmayo\b/, "Mayonnaise"],
    [/matzah\s+meal/, "Matzah Meal"],
    [/potato\s+starch/, "Potato Starch"],
    [/olive\s+oil/, "Olive Oil"],
    [/vegetable\s+oil/, "Vegetable Oil"],
    [/cake\s+mix/, "Cake Mix"],
    [/chicken\s+soup/, "Chicken Soup"],
    [/tuna/, "Tuna"],
    [/salmon/, "Salmon"]
  ];

  for (const [pattern, label] of exactPatterns) {
    if (pattern.test(lowerName)) {
      return label;
    }
  }

  const juiceMatch = lowerName.match(/\b([a-z]+)\s+juice\b/);
  if (juiceMatch) {
    return `${titleCase(juiceMatch[1])} Juice`;
  }

  const genericTypePatterns = [
    "cookies",
    "biscuits",
    "crackers",
    "sauce",
    "oil",
    "sugar",
    "flour",
    "starch",
    "syrup",
    "jam",
    "tea",
    "coffee",
    "chocolate",
    "snacks",
    "nuts"
  ];

  for (const token of genericTypePatterns) {
    if (lowerName.includes(token)) {
      return titleCase(token);
    }
  }

  return titleCase(name);
}

function isFamilyLikeLabel(label) {
  const lowerLabel = normaliseCell(label).toLowerCase();
  if (!lowerLabel) {
    return false;
  }

  return [
    "nuts",
    "juice",
    "wine",
    "mustard",
    "salmon",
    "cheese",
    "chocolate",
    "fish",
    "salad",
    "yoghurt",
    "dessert",
    "oil",
    "tea",
    "coffee",
    "cakes",
    "biscuits",
    "cookies"
  ].some((token) => lowerLabel.includes(token));
}

function deriveRollups(rawCategory, subcategory, itemName, productType) {
  const categoryLabel = normaliseCell(rawCategory);
  const subcategoryLabel = normaliseCell(subcategory);
  const nameLabel = normaliseCell(itemName);
  const productTypeLabel = normaliseCell(productType) || inferProductType(itemName);

  const wineCountryPattern = /\b(israel|italy|france|south africa|spain)\b/i;
  if (
    categoryLabel === "WINES" ||
    categoryLabel === "OTHER WINES" ||
    wineCountryPattern.test(categoryLabel)
  ) {
    return {
      category: "WINES",
      subcategory: categoryLabel === "WINES" ? "General" : titleCase(categoryLabel),
      productType: "Wine"
    };
  }

  if (
    categoryLabel === "GRAPE JUICE & KIDDUSH WINE" ||
    categoryLabel === "KEDEM" ||
    /grape juice|kiddush/i.test(nameLabel)
  ) {
    return {
      category: "GRAPE JUICE & KIDDUSH WINE",
      subcategory: categoryLabel === "GRAPE JUICE & KIDDUSH WINE" ? "General" : titleCase(categoryLabel),
      productType: /sparkling/i.test(nameLabel)
        ? "Sparkling Grape Juice"
        : /kiddush/i.test(nameLabel)
          ? "Kiddush Wine"
          : "Grape Juice"
    };
  }

  if (
    categoryLabel === "CHOCOLATES" ||
    categoryLabel === "ALPROSE" ||
    /chocolate|cocoa/i.test(nameLabel)
  ) {
    return {
      category: "CHOCOLATES",
      subcategory: categoryLabel === "CHOCOLATES" ? "General" : titleCase(categoryLabel),
      productType: "Chocolate"
    };
  }

  if (categoryLabel.includes("CHEESE")) {
    return {
      category: "CHEESES",
      subcategory: titleCase(categoryLabel),
      productType: "Cheese"
    };
  }

  if (categoryLabel === "NUTS" || subcategoryLabel.toLowerCase().includes("nuts")) {
    return {
      category: "NUTS",
      subcategory: subcategoryLabel || titleCase(categoryLabel),
      productType: "Nuts"
    };
  }

  return {
    category: categoryLabel || "Unmatched",
    subcategory: subcategoryLabel || productTypeLabel || "General",
    productType: productTypeLabel || titleCase(itemName)
  };
}

function buildCategoryLookup(catalog) {
  const lookup = new Map();

  for (const category of catalog) {
    let activeSubcategory = null;

    for (const product of category.products) {
      if (product.isSubheading) {
        activeSubcategory = normaliseCell(product.name) || null;
        continue;
      }

      const metadata = {
        category: product.category || category.name || "Unmatched",
        subcategory: activeSubcategory,
        productType: inferProductType(product.name, {
          subcategory: activeSubcategory
        })
      };

      const productKey = normaliseProductKey(product.name);
      const productSizeKey = normaliseProductSizeKey(product.name, product.size);
      lookup.set(productSizeKey, metadata);

      if (!lookup.has(productKey)) {
        lookup.set(productKey, metadata);
      }
    }
  }

  return lookup;
}

function isUnfulfilledStatus(status) {
  const normalised = normaliseStatus(status);
  return normalised !== "order ready" &&
    normalised !== "delivered" &&
    normalised !== "cancelled";
}

function buildOrderItemMetadata(item, metadataLookup = new Map()) {
  const productKey = normaliseProductKey(item.name);
  const productSizeKey = normaliseProductSizeKey(item.name, item.size);
  const metadata =
    metadataLookup.get(productSizeKey) ??
    metadataLookup.get(productKey) ?? {
      category: "Unmatched",
      subcategory: null,
      productType: inferProductType(item.name)
    };

  const rollups = deriveRollups(
    metadata.category,
    metadata.subcategory,
    item.name,
    metadata.productType || inferProductType(item.name, metadata)
  );

  return {
    productKey,
    productSizeKey,
    size: normaliseCell(item.size) || "Standard",
    category: rollups.category,
    subcategory: rollups.subcategory,
    productType: rollups.productType
  };
}

function makeQuantityAccumulator(seed) {
  return {
    ...seed,
    totalQuantity: 0,
    orderIds: new Set()
  };
}

function finaliseRows(rows, totalQuantity, quantityField = "totalQuantity") {
  return rows.map((row) => ({
    ...row,
    quantityPct: calculatePct(row[quantityField], totalQuantity)
  }));
}

function buildSalesAnalysis(orders, metadataLookup = new Map()) {
  const productTotals = new Map();
  const categoryTotals = new Map();
  const subcategoryTotals = new Map();
  const productTypeTotals = new Map();
  const productTypeSizeMix = new Map();
  const deliveryDateTotals = new Map();

  let totalQuantity = 0;

  for (const order of orders) {
    let orderQuantity = 0;

    for (const item of order.items) {
      const itemMetadata = buildOrderItemMetadata(item, metadataLookup);
      const productKey = itemMetadata.productKey;
      const category = itemMetadata.category;
      const subcategory = itemMetadata.subcategory;
      const productType = itemMetadata.productType;
      const size = itemMetadata.size;

      totalQuantity += item.quantity;
      orderQuantity += item.quantity;

      if (!productTotals.has(productKey)) {
        productTotals.set(
          productKey,
          makeQuantityAccumulator({
            name: item.name,
            category,
            subcategory,
            productType
          })
        );
      }

      const productTotal = productTotals.get(productKey);
      productTotal.totalQuantity += item.quantity;
      productTotal.orderIds.add(order.orderId);

      if (!categoryTotals.has(category)) {
        categoryTotals.set(
          category,
          makeQuantityAccumulator({
            category,
            productCountSet: new Set()
          })
        );
      }

      const categoryTotal = categoryTotals.get(category);
      categoryTotal.totalQuantity += item.quantity;
      categoryTotal.orderIds.add(order.orderId);
      categoryTotal.productCountSet.add(productKey);

      const subcategoryKey = `${category}|||${subcategory}`;
      if (!subcategoryTotals.has(subcategoryKey)) {
        subcategoryTotals.set(
          subcategoryKey,
          makeQuantityAccumulator({
            category,
            subcategory,
            productCountSet: new Set()
          })
        );
      }

      const subcategoryTotal = subcategoryTotals.get(subcategoryKey);
      subcategoryTotal.totalQuantity += item.quantity;
      subcategoryTotal.orderIds.add(order.orderId);
      subcategoryTotal.productCountSet.add(productKey);

      const productTypeKey = `${category}|||${subcategory}|||${productType}`;
      if (!productTypeTotals.has(productTypeKey)) {
        productTypeTotals.set(
          productTypeKey,
          makeQuantityAccumulator({
            category,
            subcategory,
            productType,
            productNames: new Set()
          })
        );
      }

      const productTypeTotal = productTypeTotals.get(productTypeKey);
      productTypeTotal.totalQuantity += item.quantity;
      productTypeTotal.orderIds.add(order.orderId);
      productTypeTotal.productNames.add(item.name);

      const sizeMixKey = `${productTypeKey}|||${size}`;
      if (!productTypeSizeMix.has(sizeMixKey)) {
        productTypeSizeMix.set(sizeMixKey, {
          category,
          subcategory,
          productType,
          size,
          totalQuantity: 0
        });
      }

      productTypeSizeMix.get(sizeMixKey).totalQuantity += item.quantity;
    }

    const deliveryDate = normaliseCell(order.deliveryDate) || "Unknown";
    if (!deliveryDateTotals.has(deliveryDate)) {
      deliveryDateTotals.set(deliveryDate, {
        deliveryDate,
        orderCount: 0,
        totalQuantity: 0
      });
    }

    const deliveryDateTotal = deliveryDateTotals.get(deliveryDate);
    deliveryDateTotal.orderCount += 1;
    deliveryDateTotal.totalQuantity += orderQuantity;
  }

  const productRows = finaliseRows(
    Array.from(productTotals.values())
      .map((product) => ({
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
        productType: product.productType,
        totalQuantity: product.totalQuantity,
        orderCount: product.orderIds.size
      }))
      .sort(sortByQuantityDesc),
    totalQuantity
  );

  const categoryRows = finaliseRows(
    Array.from(categoryTotals.values())
      .map((category) => ({
        category: category.category,
        totalQuantity: category.totalQuantity,
        orderCount: category.orderIds.size,
        productCount: category.productCountSet.size
      }))
      .sort(sortByQuantityDesc),
    totalQuantity
  );

  const categoryQuantityLookup = new Map(
    categoryRows.map((category) => [category.category, category.totalQuantity])
  );

  const subcategoryRows = finaliseRows(
    Array.from(subcategoryTotals.values())
      .map((subcategory) => ({
        category: subcategory.category,
        subcategory: subcategory.subcategory,
        totalQuantity: subcategory.totalQuantity,
        orderCount: subcategory.orderIds.size,
        productCount: subcategory.productCountSet.size
      }))
      .sort(sortByQuantityDesc),
    totalQuantity
  ).map((subcategory) => ({
    ...subcategory,
    categoryQuantityPct: calculatePct(
      subcategory.totalQuantity,
      categoryQuantityLookup.get(subcategory.category) ?? 0
    )
  }));

  const productTypeQuantityLookup = new Map();
  const productTypeRows = finaliseRows(
    Array.from(productTypeTotals.values())
      .map((productType) => {
        const row = {
          category: productType.category,
          subcategory: productType.subcategory,
          productType: productType.productType,
          totalQuantity: productType.totalQuantity,
          orderCount: productType.orderIds.size,
          productCount: productType.productNames.size
        };
        productTypeQuantityLookup.set(
          `${row.category}|||${row.subcategory}|||${row.productType}`,
          row.totalQuantity
        );
        return row;
      })
      .sort(sortByQuantityDesc),
    totalQuantity
  ).map((productType) => ({
    ...productType,
    subcategoryQuantityPct: calculatePct(
      productType.totalQuantity,
      subcategoryRows.find(
        (subcategory) =>
          subcategory.category === productType.category &&
          subcategory.subcategory === productType.subcategory
      )?.totalQuantity ?? 0
    )
  }));

  const productTypeSizeRows = Array.from(productTypeSizeMix.values())
    .map((sizeMix) => ({
      ...sizeMix,
      quantityPctWithinProductType: calculatePct(
        sizeMix.totalQuantity,
        productTypeQuantityLookup.get(
          `${sizeMix.category}|||${sizeMix.subcategory}|||${sizeMix.productType}`
        ) ?? 0
      )
    }))
    .sort((left, right) => {
      if (left.productType !== right.productType) {
        return left.productType.localeCompare(right.productType);
      }

      return right.totalQuantity - left.totalQuantity;
    });

  const unmatchedProducts = productRows.filter((product) => product.category === "Unmatched");

  return {
    summary: {
      orderCount: orders.length,
      totalQuantity,
      uniqueProducts: productRows.length,
      uniqueProductTypes: productTypeRows.length,
      matchedProducts: productRows.length - unmatchedProducts.length,
      unmatchedProducts: unmatchedProducts.length
    },
    orders: orders.map((order) => ({
      orderId: order.orderId,
      createdAt: order.createdAt,
      customerName: order.customerName,
      deliveryDate: order.deliveryDate,
      deliverySlot: order.deliverySlot,
      status: order.status || "",
      totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      uniqueItems: order.items.length
    })),
    ordersDetailed: orders.map((order) => ({
      orderId: order.orderId,
      createdAt: order.createdAt,
      customerName: order.customerName,
      deliveryDate: order.deliveryDate,
      deliverySlot: order.deliverySlot,
      status: order.status || "",
      items: order.items.map((item) => ({
        name: item.name,
        size: normaliseCell(item.size) || "Standard",
        quantity: item.quantity
      }))
    })),
    productTotals: productRows,
    categoryTotals: categoryRows,
    subcategoryTotals: subcategoryRows,
    productTypeTotals: productTypeRows,
    productTypeSizeMix: productTypeSizeRows,
    unmatchedProducts,
    deliveryDateTotals: finaliseRows(
      Array.from(deliveryDateTotals.values()).sort((left, right) =>
        left.deliveryDate.localeCompare(right.deliveryDate)
      ),
      totalQuantity
    )
  };
}

function calculateUnfulfilledDemand(orders, query, metadataLookup = new Map()) {
  const search = normaliseCell(query).toLowerCase();
  if (!search) {
    return {
      query: "",
      totalQuantity: 0,
      matchingOrders: 0,
      matches: [],
      orderLines: []
    };
  }

  const aggregatedMatches = new Map();
  const orderLines = [];
  const matchedOrderIds = new Set();

  for (const order of orders) {
    if (!isUnfulfilledStatus(order.status)) {
      continue;
    }

    for (const item of order.items) {
      const itemMetadata = buildOrderItemMetadata(item, metadataLookup);
      const searchableValues = [
        item.name,
        itemMetadata.productType,
        itemMetadata.subcategory,
        itemMetadata.category
      ]
        .map((value) => normaliseCell(value).toLowerCase())
        .filter(Boolean);

      if (!searchableValues.some((value) => value.includes(search))) {
        continue;
      }

      const aggregateKey = itemMetadata.productKey;
      if (!aggregatedMatches.has(aggregateKey)) {
        aggregatedMatches.set(aggregateKey, {
          name: item.name,
          category: itemMetadata.category,
          subcategory: itemMetadata.subcategory,
          productType: itemMetadata.productType,
          totalQuantity: 0,
          orderIds: new Set()
        });
      }

      const aggregate = aggregatedMatches.get(aggregateKey);
      aggregate.totalQuantity += item.quantity;
      aggregate.orderIds.add(order.orderId);

      matchedOrderIds.add(order.orderId);
      orderLines.push({
        orderId: order.orderId,
        status: order.status || "",
        deliveryDate: order.deliveryDate,
        customerName: order.customerName,
        name: item.name,
        size: itemMetadata.size,
        category: itemMetadata.category,
        subcategory: itemMetadata.subcategory,
        productType: itemMetadata.productType,
        quantity: item.quantity
      });
    }
  }

  const matches = Array.from(aggregatedMatches.values())
    .map((match) => ({
      name: match.name,
      category: match.category,
      subcategory: match.subcategory,
      productType: match.productType,
      totalQuantity: match.totalQuantity,
      orderCount: match.orderIds.size
    }))
    .sort(sortByQuantityDesc);

  return {
    query: search,
    totalQuantity: matches.reduce((sum, match) => sum + match.totalQuantity, 0),
    matchingOrders: matchedOrderIds.size,
    matches,
    orderLines: orderLines.sort((left, right) => {
      if (left.deliveryDate !== right.deliveryDate) {
        return left.deliveryDate.localeCompare(right.deliveryDate);
      }

      if (left.orderId !== right.orderId) {
        return left.orderId.localeCompare(right.orderId);
      }

      return left.name.localeCompare(right.name);
    })
  };
}

module.exports = {
  buildSalesAnalysis,
  buildCategoryLookup,
  calculateUnfulfilledDemand,
  inferProductType,
  isUnfulfilledStatus,
  isOrderDetailSheetTitle,
  parseOrderSheetValues
};
