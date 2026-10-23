#!/usr/bin/env node
"use strict";

// Governing rule: CLOSE-1 WP1 / CATO-D2 Annex A v0.2. The FRED Services Terms of
// Use prohibit storing, caching or archiving FRED content and using it "in
// connection with the development or training of any software program or
// system". Cato calls no FRED endpoint. This guard fails if one returns in any
// source or configuration file.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const SOURCE = /\.(js|json|yml|yaml)$/;
const SKIP = new Set(["node_modules", ".git", "package-lock.json", "test"]); // tests may name forbidden strings

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SOURCE.test(entry.name) && full !== __filename) out.push(full);
  }
  return out;
}

const offenders = walk(root).filter((file) => /stlouisfed\.org|FRED_API_KEY|fredSeries/.test(fs.readFileSync(file, "utf8")));
assert.deepStrictEqual(offenders.map((f) => path.relative(root, f)), [], "FRED endpoint, key or client found in source or configuration");

const gate = require("../gate_core.js");
assert.strictEqual(gate.STRESS_THRESHOLD_STATUS, "PROVISIONAL_POLICY_NOT_BACKTESTED_ON_OFR_FSI");
const implementation = fs.readFileSync(path.join(root, "index.js"), "utf8");
assert.ok((implementation.match(/STRESS_THRESHOLD_STATUS/g) || []).length >= 5, "every stress-reading output must carry the provisional threshold label");

console.log("PASS  no FRED endpoint, key or client; stress thresholds labelled provisional on the OFR FSI");
