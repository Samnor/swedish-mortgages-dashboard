#!/usr/bin/env node
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "public/data/latest.json";
const snapshot = JSON.parse(readFileSync(path, "utf8"));

assertRecord(snapshot, "snapshot");
assertIsoDate(snapshot.generatedAt, "generatedAt");
assertOptionalString(snapshot.environment, "environment");
assertOptionalString(snapshot.source, "source");
assertOptionalString(snapshot.queryId, "queryId");

if (!Array.isArray(snapshot.rates)) {
  throw new Error("Expected rates to be an array.");
}

let previousDate = "";
snapshot.rates.forEach((row, index) => {
  assertRecord(row, `rates[${index}]`);
  assertDateOnly(row.date, `rates[${index}].date`);
  assertFiniteNumber(row.policyRate, `rates[${index}].policyRate`);
  assertFiniteNumber(row.mortgageBond5y, `rates[${index}].mortgageBond5y`);

  if (previousDate && row.date < previousDate) {
    throw new Error("Expected rates to be sorted ascending by date.");
  }
  previousDate = row.date;
});

function assertRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }
}

function assertIsoDate(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`Expected ${label} to be an ISO date string.`);
  }
}

function assertDateOnly(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Expected ${label} to be YYYY-MM-DD.`);
  }
}

function assertFiniteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected ${label} to be a finite number.`);
  }
}

function assertOptionalString(value, label) {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string when present.`);
  }
}
