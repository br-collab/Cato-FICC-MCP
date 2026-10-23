#!/usr/bin/env node
"use strict";

// Governing rule: ORDER-CATO-D2 scope 1-3 requires removal of CME Term SOFR,
// primary public sources for gate inputs, live/uncached residual FRED calls,
// and the prescribed FRED, NY Fed, and CoinGecko notices.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const implementation = fs.readFileSync(path.join(root, "index.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

for (const forbidden of ["get_term_sofr", "include_term_sofr", 'fredSeries("SOFR"', 'fredSeries("DGS', '"SOFR1"', '"SOFR3"', '"SOFR6"', '"SOFR12"']) {
  assert.ok(!implementation.includes(forbidden), `licensed or non-primary source path returned: ${forbidden}`);
}

for (const source of ["NYFED_BASE", "treasuryYieldCurve", "OFR_FSI_CSV", "GLEIF_BASE", "OPENFIGI_BASE", "OFAC_SDN_CSV"]) {
  assert.ok(implementation.includes(source), `missing admitted source: ${source}`);
}

for (const tool of ["get_sec_fails_to_deliver", "get_ofr_financial_stress_index", "lookup_lei", "map_cusip_to_figi", "screen_ofac_sdn", "get_treasury_average_interest_rates"]) {
  assert.match(implementation, new RegExp(`name: "${tool}"`), `missing tool declaration: ${tool}`);
  assert.match(implementation, new RegExp(`case "${tool}"`), `missing fail-closed handler: ${tool}`);
}

const toolNames = [...implementation.matchAll(/\n\s+name: "([a-z0-9_]+)",/g)].map((match) => match[1]);
assert.strictEqual(toolNames.length, 29, "published tool count must match implementation");

assert.match(implementation, /if \(data\?\.error \|\| !Array\.isArray\(data\?\.data\)\) return \{ error:/, "Treasury failure must be unavailable, not static");
assert.match(implementation, /if \(csv\?\.error \|\| typeof csv !== "string"\) return \{ error:/, "public CSV failures must be unavailable");
assert.doesNotMatch(implementation, /writeFile|appendFile|createWriteStream|localStorage|fred_historical_ingest/, "FRED content must not be written or archived");
assert.doesNotMatch(implementation, /(?:let|const)\s+_[A-Za-z0-9_]*fred[A-Za-z0-9_]*\s*=|(?:let|const)\s+[A-Za-z0-9_]*FRED[A-Za-z0-9_]*CACHE\s*=/, "FRED content must not have a process cache");

for (const notice of [
  "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.",
  "does not sanction or endorse any particular republication, and has no liability for your use",
  "Price data provided by CoinGecko.",
]) {
  assert.ok(implementation.includes(notice), `response notice missing: ${notice}`);
  assert.ok(readme.includes(notice), `README notice missing: ${notice}`);
}

for (const excluded of ["FINRA", "CME Term SOFR", "Bloomberg", "Nasdaq / NYSE"]) {
  assert.ok(readme.includes(excluded), `README exclusion missing: ${excluded}`);
}

console.log("PASS  license truth, primary-source routing, notices, admissions, and fail-closed declarations");
