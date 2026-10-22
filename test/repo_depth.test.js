#!/usr/bin/env node
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const implementation = fs.readFileSync(path.resolve(__dirname, "..", "index.js"), "utf8");
const readme = fs.readFileSync(path.resolve(__dirname, "..", "README.md"), "utf8");
assert.match(implementation, /name: "get_cleared_repo_segments"/);
for (const segment of ["DVP", "GCF", "TRI"]) for (const measure of ["AR", "TV"]) for (const tenor of ["OO", "TOT"]) assert.ok(implementation.includes(`REPO-${segment}_${measure}_${tenor}-P`));
assert.match(implementation, /series_id: "STLFSI4"/);
assert.match(implementation, /St\. Louis Fed Financial Stress Index/);
assert.doesNotMatch(implementation, /description: "OFR Financial Stress Index/);
assert.match(readme, /Sections and admission/);
assert.match(readme, /Equities, listed options, and foreign exchange are not admitted/);
console.log("PASS  verified repo mnemonics, truthful stress label, and section admission rule");
