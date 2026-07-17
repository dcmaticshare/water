import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../model-data.js", import.meta.url), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: "model-data.js" });

const schema = sandbox.window.IWATER_CONFIGURATION_SCHEMA;
const records = schema?.records || [];

function surfaceFor(record) {
  if (record.object === "User") return "users";
  if (record.object === "Location") return "location";
  if (record.object === "Project") return "project";
  if (record.object === "Unit") return "unit";
  if (record.object !== "Water Project") return null;
  if (record.category === "Info") return "waterproject-info";
  if (record.category === "Connections") return "waterproject-connections";
  if (record.category === "Protocol" || record.category === "Protocols") return "waterproject-protocols";
  if (record.category === "Notification") return "waterproject-notifications";
  return null;
}

const rows = records.map((record) => Number(record.excelRow));
const uniqueRows = new Set(rows);
const missingSurfaces = records.filter((record) => !surfaceFor(record));
const missingRows = [];
for (let row = 2; row <= Number(schema.recordCount) + 1; row += 1) {
  if (!uniqueRows.has(row)) missingRows.push(row);
}

const surfaces = records.reduce((counts, record) => {
  const surface = surfaceFor(record) || "unmapped";
  counts[surface] = (counts[surface] || 0) + 1;
  return counts;
}, {});

const result = {
  expected: Number(schema.recordCount),
  records: records.length,
  uniqueExcelRows: uniqueRows.size,
  missingRows,
  missingSurfaces: missingSurfaces.map((record) => record.excelRow),
  surfaces,
};

console.log(JSON.stringify(result, null, 2));

if (
  records.length !== Number(schema.recordCount) ||
  uniqueRows.size !== records.length ||
  missingRows.length ||
  missingSurfaces.length
) {
  process.exitCode = 1;
}
