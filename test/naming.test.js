#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const implementation = fs.readFileSync(path.join(root, "index.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.match(implementation, /name: "cato_sec"/, "MCP identity must be cato_sec");
assert.match(implementation, /case "cato_sec"/, "canonical gate handler must be cato_sec");
const retiredGateName = "cato" + "_gate";
assert.ok(!implementation.includes(`name: "${retiredGateName}"`), "ambiguous public gate name must not return");
assert.ok(!implementation.includes(`case "${retiredGateName}"`), "ambiguous handler name must not return");
assert.match(readme, /Cato Sec \(`cato_sec`\)/, "README must publish the canonical identity");
assert.strictEqual(pkg.name, "cato-sec-mcp", "package must carry the Cato Sec identity");
assert.deepStrictEqual(pkg.bin, { cato_sec: "./index.js" }, "CLI must expose cato_sec only");

console.log("PASS  Cato Sec naming is canonical across MCP, package, CLI, and README");
