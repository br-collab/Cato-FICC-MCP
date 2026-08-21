#!/usr/bin/env node
/**
 * test/gate_core.test.js — golden-vector test for the Cato decision core.
 * ==========================================================================
 * PURPOSE: gate_core.js is the single source of truth for Cato thresholds
 * (see its header). Until this file existed, nothing in this repository's
 * own CI verified that source against a doctrine-expected value — CI ran
 * `node --check index.js` (syntax only) and an MCP tools/list roundtrip
 * (transport only). The most safety-critical file in the repo was the
 * least verified thing in it (2026-08-21 audit finding).
 *
 * This is a subset of the doctrine boundary cases also carried, in full,
 * as parity/cato_golden_vectors.json in the Aureon repo (br-collab/aureon),
 * which cross-checks this same file against the Python twin
 * (aureon/mcp/cato_client.py). This file exists so cato-mcp verifies its
 * own decision core in isolation, without depending on that sibling repo
 * being checked out.
 *
 * No dependencies — plain assert, matching gate_core.js's own "no
 * dependencies" contract.
 */

const assert = require("assert");
const { computeGateDecision, pickRecommendedChain } = require("../gate_core.js");

const VECTORS = [
  { id: "all_clear", ofr_stress: 0.20, gas_gwei: 20.0, sofr_delta_bps: 2.0, expect: { gate_decision: "PROCEED", recommended_rail: "atomic" } },
  { id: "ofr_hold_boundary_eq", ofr_stress: 0.50, gas_gwei: 20.0, sofr_delta_bps: 0.0, expect: { gate_decision: "PROCEED", recommended_rail: "atomic" } },
  { id: "ofr_hold_trip", ofr_stress: 0.51, gas_gwei: 20.0, sofr_delta_bps: 0.0, expect: { gate_decision: "HOLD", recommended_rail: "traditional" } },
  { id: "ofr_escalate_boundary_eq", ofr_stress: 1.00, gas_gwei: 20.0, sofr_delta_bps: 0.0, expect: { gate_decision: "HOLD", recommended_rail: "traditional" } },
  { id: "ofr_escalate_trip", ofr_stress: 1.01, gas_gwei: 20.0, sofr_delta_bps: 0.0, expect: { gate_decision: "ESCALATE", recommended_rail: "human_authority" } },
  { id: "gas_boundary_eq", ofr_stress: 0.10, gas_gwei: 50.0, sofr_delta_bps: 0.0, expect: { gate_decision: "PROCEED", recommended_rail: "atomic" } },
  { id: "gas_trip", ofr_stress: 0.10, gas_gwei: 50.5, sofr_delta_bps: 0.0, expect: { gate_decision: "HOLD", recommended_rail: "traditional" } },
  { id: "sofr_delta_trip", ofr_stress: 0.10, gas_gwei: 20.0, sofr_delta_bps: 10.5, expect: { gate_decision: "HOLD", recommended_rail: "traditional" } },
  { id: "gas_missing_clear", ofr_stress: 0.10, gas_gwei: null, sofr_delta_bps: 0.0, expect: { gate_decision: "PROCEED", recommended_rail: "atomic" } },
  { id: "escalate_overrides_gas", ofr_stress: 2.00, gas_gwei: 80.0, sofr_delta_bps: 0.0, expect: { gate_decision: "ESCALATE", recommended_rail: "human_authority" } },
  // 2026-08-21 audit finding: a missing/malformed OFR reading (NaN in
  // production, via parseFloat(".") on a FRED missing-observation marker)
  // must never fall through to PROCEED. Each of NaN, +Infinity, null,
  // undefined, and a non-numeric type must HOLD, not PROCEED or ESCALATE.
  { id: "ofr_stress_nan", ofr_stress: NaN, gas_gwei: 20.0, sofr_delta_bps: 0.0, expect: { gate_decision: "HOLD", recommended_rail: "traditional" } },
  { id: "ofr_stress_positive_infinity", ofr_stress: Infinity, gas_gwei: 20.0, sofr_delta_bps: 0.0, expect: { gate_decision: "HOLD", recommended_rail: "traditional" } },
  { id: "ofr_stress_null", ofr_stress: null, gas_gwei: 20.0, sofr_delta_bps: 0.0, expect: { gate_decision: "HOLD", recommended_rail: "traditional" } },
  { id: "ofr_stress_undefined", ofr_stress: undefined, gas_gwei: 20.0, sofr_delta_bps: 0.0, expect: { gate_decision: "HOLD", recommended_rail: "traditional" } },
  { id: "ofr_stress_string", ofr_stress: "1.5", gas_gwei: 20.0, sofr_delta_bps: 0.0, expect: { gate_decision: "HOLD", recommended_rail: "traditional" } },
];

const CHAIN_STATE = {
  ethereum: { gas_gwei: 20.0 },
  base: { gas_gwei: 0.01 },
  arbitrum: { gas_gwei: 0.6 },
  solana: { fee_usd_estimate: 0.0004 },
};

let failures = 0;
for (const v of VECTORS) {
  const d = computeGateDecision({
    ofr_stress: v.ofr_stress,
    gas_gwei: v.gas_gwei,
    sofr_delta_bps: v.sofr_delta_bps,
  });
  try {
    assert.strictEqual(d.gate_decision, v.expect.gate_decision, `${v.id}: gate_decision`);
    assert.strictEqual(d.recommended_rail, v.expect.recommended_rail, `${v.id}: recommended_rail`);
    console.log(`PASS  ${v.id}`);
  } catch (err) {
    failures++;
    console.error(`FAIL  ${v.id}: ${err.message} (got ${d.gate_decision}/${d.recommended_rail})`);
  }
}

// pickRecommendedChain sanity check — not a doctrine boundary, just
// confirms the picker resolves against a live chain_state.
const chain = pickRecommendedChain(CHAIN_STATE);
try {
  assert.strictEqual(chain, "solana", "pickRecommendedChain(CHAIN_STATE)");
  console.log("PASS  pick_recommended_chain_solana");
} catch (err) {
  failures++;
  console.error(`FAIL  pick_recommended_chain_solana: ${err.message} (got ${chain})`);
}

console.log("-".repeat(60));
if (failures) {
  console.error(`${failures} vector(s) failed.`);
  process.exit(1);
}
console.log(`${VECTORS.length + 1} vector(s) passed.`);
