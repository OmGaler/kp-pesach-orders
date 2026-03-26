const fs = require("node:fs");
const path = require("node:path");
const { calculateUnfulfilledDemand } = require("../lib/sales-analysis");

function readAnalysisFile(projectRoot) {
  const analysisPath = path.join(projectRoot, "notebooks", "data", "sales-analysis.json");
  if (!fs.existsSync(analysisPath)) {
    throw new Error(
      "Could not find notebooks/data/sales-analysis.json. Run `npm run analyse:sales` first."
    );
  }

  return JSON.parse(fs.readFileSync(analysisPath, "utf8"));
}

function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    throw new Error("Provide a product query, for example: `node scripts/query-unfulfilled-demand.js honey`");
  }

  const projectRoot = path.resolve(__dirname, "..");
  const analysis = readAnalysisFile(projectRoot);
  const result = calculateUnfulfilledDemand(analysis.ordersDetailed ?? [], query);

  console.log(`Query: ${query}`);
  console.log(`Unfulfilled quantity needed: ${result.totalQuantity}`);
  console.log(`Matching unfulfilled orders: ${result.matchingOrders}`);

  if (!result.matches.length) {
    console.log("No matching products found in unfulfilled orders.");
    return;
  }

  console.log("\nProducts:");
  for (const match of result.matches) {
    console.log(
      `- ${match.name}: ${match.totalQuantity} (${match.orderCount} orders)`
    );
  }

  console.log("\nOrder lines:");
  for (const line of result.orderLines) {
    console.log(
      `- ${line.orderId} | ${line.status} | ${line.deliveryDate} | ${line.name} ${line.size ? `(${line.size})` : ""}: ${line.quantity}`
    );
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
