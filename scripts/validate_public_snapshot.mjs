#!/usr/bin/env node
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "public/data/latest.json";
const snapshot = JSON.parse(readFileSync(path, "utf8"));

assertRecord(snapshot, "snapshot");
assertIsoDate(snapshot.generatedAt, "generatedAt");
assertOptionalString(snapshot.environment, "environment");
assertOptionalString(snapshot.source, "source");
assertOptionalString(snapshot.queryId, "queryId");
assertOptionalString(snapshot.negotiationSource, "negotiationSource");
assertOptionalString(snapshot.negotiationQueryId, "negotiationQueryId");

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

if (!Array.isArray(snapshot.negotiationOptions) || snapshot.negotiationOptions.length === 0) {
  throw new Error("Expected negotiationOptions to be a non-empty array.");
}

let previousYears = -Infinity;
snapshot.negotiationOptions.forEach((row, index) => {
  assertRecord(row, `negotiationOptions[${index}]`);
  assertString(row.periodLabel, `negotiationOptions[${index}].periodLabel`);
  assertString(
    row.periodLabelDisplay,
    `negotiationOptions[${index}].periodLabelDisplay`,
  );
  assertFiniteNumber(row.periodYears, `negotiationOptions[${index}].periodYears`);
  assertFiniteNumber(row.minListRate, `negotiationOptions[${index}].minListRate`);
  assertFiniteNumber(row.lowerListRate, `negotiationOptions[${index}].lowerListRate`);
  assertFiniteNumber(
    row.medianListRate,
    `negotiationOptions[${index}].medianListRate`,
  );
  assertFiniteNumber(row.upperListRate, `negotiationOptions[${index}].upperListRate`);
  assertFiniteNumber(row.maxListRate, `negotiationOptions[${index}].maxListRate`);
  assertFiniteNumber(
    row.medianFundingCost,
    `negotiationOptions[${index}].medianFundingCost`,
  );
  assertFiniteNumber(row.lowerMargin, `negotiationOptions[${index}].lowerMargin`);
  assertFiniteNumber(row.upperMargin, `negotiationOptions[${index}].upperMargin`);
  assertFiniteNumber(row.bankCount, `negotiationOptions[${index}].bankCount`);

  if (row.periodYears < previousYears) {
    throw new Error("Expected negotiationOptions to be sorted by periodYears.");
  }
  if (
    row.minListRate > row.lowerListRate ||
    row.lowerListRate > row.medianListRate ||
    row.medianListRate > row.upperListRate ||
    row.upperListRate > row.maxListRate
  ) {
    throw new Error("Expected list-rate quantiles to be ordered.");
  }
  if (row.medianFundingCost > row.maxListRate) {
    throw new Error("Expected medianFundingCost not to exceed maxListRate.");
  }
  previousYears = row.periodYears;
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

function assertString(value, label) {
  if (typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string.`);
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
