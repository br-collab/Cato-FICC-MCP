#!/usr/bin/env node
"use strict";

const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");

const imported = spawnSync(
  process.execPath,
  ["-e", "require('./index.js'); process.stdout.write('imported')"],
  { cwd: root, encoding: "utf8", timeout: 5000 }
);
assert.strictEqual(imported.status, 0, imported.stderr);
assert.strictEqual(imported.stdout, "imported", "requiring index.js must not start stdio");
assert.strictEqual(imported.stderr, "", "requiring index.js must not announce a server");

assert.throws(
  () => require("cato-sec-mcp"),
  (error) => error && error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
  "the package root must not expose the executable as a library API"
);

const gateCore = require("cato-sec-mcp/gate-core");
assert.strictEqual(typeof gateCore.computeGateDecision, "function");
assert.strictEqual(typeof gateCore.pickRecommendedChain, "function");

console.log("PASS  executable import is inert and gate-core is the only package subpath");
