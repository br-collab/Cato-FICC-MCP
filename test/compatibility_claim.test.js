#!/usr/bin/env node
"use strict";

/* Fail CI when the published compatibility claim is greener than its evidence. */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const status = JSON.parse(fs.readFileSync(path.join(root, "COMPATIBILITY_STATUS.json"), "utf8"));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const implementationText = ["gate_core.js", "index.js"]
  .map((name) => fs.readFileSync(path.join(root, name), "utf8"))
  .join("\n");

assert.strictEqual(status.schema_version, 1, "compatibility schema version");
assert.ok(Array.isArray(status.differences), "differences must be an array");
assert.ok(status.differences.length > 0, "an incompatible status must name its differences");

const open = status.differences.filter((difference) => difference.resolved === false);
assert.ok(open.length > 0, "recorded Cato Sec/aureon gaps must remain explicit until resolved");
assert.strictEqual(
  status.status,
  "INCOMPATIBLE",
  "open decision or production-input differences cannot be labelled compatible"
);

for (const id of ["xrpl-routing", "production-stress-series"]) {
  assert.ok(open.some((difference) => difference.id === id), `missing declared gap: ${id}`);
}

assert.ok(readme.includes("COMPATIBILITY_STATUS.json"), "README must link the status record");
assert.ok(
  readme.includes("Current compatibility status: INCOMPATIBLE"),
  "README must state the current status without requiring inference"
);

const forbidden = /bit-for-bit identical decisions|parity principle \(hard rule\)/i;
assert.ok(!forbidden.test(readme), "README contains an unconditional parity claim");
assert.ok(!forbidden.test(implementationText), "code comments contain an unconditional claim");

console.log(`PASS  compatibility claim is ${status.status} with ${open.length} declared gaps`);
