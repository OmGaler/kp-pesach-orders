# Sales analysis notebook

Run `node scripts/export-sales-analysis.js` from the project root to refresh local analysis data from the Google Sheets workbook.

The notebook file can be committed safely. The exporter writes fresh local data into `notebooks/data/`, which stays ignored:

- `sales-analysis.json`
- `orders.csv`
- `product-totals.csv`
- `category-totals.csv`
- `subcategory-totals.csv`
- `product-type-totals.csv`
- `product-type-size-mix.csv`
- `delivery-date-totals.csv`
- `unmatched-products.csv`

Open `notebooks/sales-analysis.ipynb` locally to explore category share, product-type rollups, size mix for key groups, and a few simple charts.
