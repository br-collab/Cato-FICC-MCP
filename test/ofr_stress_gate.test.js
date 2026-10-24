#!/usr/bin/env node
"use strict";

// Governing rule: CLOSE-1 WP1. The stress gate reads the OFR FSI, labels its
// thresholds provisional, never calls FRED, and holds on a malformed feed.
// Drives the real stdio server with network replaced by fixtures.

const assert = require("assert");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");

function call(scenario, tool, args = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-r", "./test/fixtures/mock_axios.js", "index.js"], {
      cwd: root, env: { ...process.env, CATO_TEST_SCENARIO: scenario },
    });
    let buffer = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error(`timeout calling ${tool}`)); }, 20000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      for (const line of buffer.split("\n").slice(0, -1)) {
        const message = JSON.parse(line);
        if (message.id === 2) {
          clearTimeout(timer);
          child.kill();
          resolve(JSON.parse(message.result.content[0].text));
        }
      }
      buffer = buffer.split("\n").pop();
    });
    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } } });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } });
  });
}

(async () => {
  const stress = await call("normal", "get_ofr_stress_index", { days: 2 });
  assert.strictEqual(stress.series_id, "OFR FSI");
  assert.strictEqual(stress.threshold_status, "PROVISIONAL_POLICY_NOT_BACKTESTED_ON_OFR_FSI");
  assert.deepStrictEqual(stress.stress_index[0], { date: "2026-10-22", value: "-1.20" }, "newest observation first");

  const calm = await call("normal", "get_atomic_settlement_gate");
  assert.strictEqual(calm.inputs.ofr_stress, -1.2);
  assert.strictEqual(calm.thresholds.stress_threshold_status, "PROVISIONAL_POLICY_NOT_BACKTESTED_ON_OFR_FSI");
  assert.notStrictEqual(calm.gate_decision, "ESCALATE");

  const elevated = await call("elevated", "get_atomic_settlement_gate");
  assert.strictEqual(elevated.gate_decision, "HOLD");
  assert.ok(elevated.reasons.some((r) => r.startsWith("OFR FSI at 0.80") && r.includes("provisional policy")));

  const malformed = await call("malformed", "get_atomic_settlement_gate");
  assert.strictEqual(malformed.gate_decision, "HOLD", "a malformed OFR publication must hold the gate");

  const tips = await call("normal", "get_tips_yields", { tenor: "10y" });
  assert.deepStrictEqual(tips.data["10y_real_yield"], { date: "2026-10-22", value: "1.90" });
  assert.strictEqual(tips.data["10y_breakeven"].value, "2.20", "breakeven is nominal minus real, same date and tenor");

  const cpi = await call("normal", "get_cpi", { series: "headline", months: 2 });
  assert.deepStrictEqual(cpi.cpi_data.headline_cpi.observations[0], { date: "2026-09", value: "325.0" });

  const balance = await call("normal", "get_fed_balance_sheet");
  assert.strictEqual(balance.unavailable, true);
  assert.match(balance.primary_source, /federalreserve\.gov\/releases\/h41/);

  console.log("PASS  OFR FSI gate input, provisional label, malformed-feed hold, Treasury TIPS, BLS CPI, declared absences");
})().catch((error) => { console.error(error); process.exit(1); });
