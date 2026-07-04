/**
 * gate_core.js — Cato decision core (pure, no I/O)
 * =================================================
 * WS-0.2 (AUR-ROADMAP-001): the Parity Principle requires the external
 * Node MCP server and the in-process Python twin
 * (aureon/mcp/cato_client.py::atomic_settlement_gate) to produce
 * bit-for-bit identical DECISIONS for identical inputs. Parity drifted
 * because this logic lived inline in the index.js tool handler, behind
 * live fetches, where it could not be driven by a test vector.
 *
 * This module is that logic, extracted verbatim and unchanged:
 *   computeGateDecision({ ofr_stress, gas_gwei, sofr_delta_bps })
 *     → { gate_decision, reasons, recommended_rail }
 *   pickRecommendedChain(chainState)
 *     → "solana" | "base" | "ethereum" | null
 *
 * index.js requires this module (single source of truth for thresholds),
 * and parity/run_parity.py drives it with the golden vectors. Any change
 * to this file is a doctrine event (Cato thresholds are doctrine, not
 * configuration) and must be mirrored in the Python twin in the same
 * change set.
 *
 * No dependencies. CommonJS, matching index.js.
 */

// Doctrine thresholds (Duffie 2025, Brookings; Cato v0.2.2 backtest).
const CATO_OFR_ESCALATE_THRESHOLD = 1.0;
const CATO_OFR_HOLD_THRESHOLD = 0.5;
const CATO_GAS_GWEI_HOLD_THRESHOLD = 50.0;
const CATO_SOFR_DELTA_HOLD_BPS = 10.0; // funding-market shock detector

/**
 * Pure Cato gate decision. Inputs:
 *   ofr_stress     — OFR STLFSI4 value (number; callers pass 0 if unknown)
 *   gas_gwei       — ETH L1 gas in gwei, or null/undefined if unavailable
 *   sofr_delta_bps — |SOFR(t) − SOFR(t−1)| × 100, or null if unavailable
 */
function computeGateDecision({ ofr_stress, gas_gwei, sofr_delta_bps }) {
  const reasons = [];
  let gate_decision = "PROCEED";
  let recommended_rail = "atomic";

  // ESCALATE first — systemic stress overrides everything
  if (ofr_stress > CATO_OFR_ESCALATE_THRESHOLD) {
    gate_decision = "ESCALATE";
    recommended_rail = "human_authority";
    reasons.push(`OFR stress index at ${ofr_stress.toFixed(2)} — systemic stress threshold (>${CATO_OFR_ESCALATE_THRESHOLD}) breached`);
  } else {
    // HOLD if non-systemic friction
    if (ofr_stress > CATO_OFR_HOLD_THRESHOLD) {
      gate_decision = "HOLD";
      reasons.push(`OFR stress index at ${ofr_stress.toFixed(2)} — above-average stress (>${CATO_OFR_HOLD_THRESHOLD})`);
    }
    if (gas_gwei !== null && gas_gwei !== undefined && gas_gwei > CATO_GAS_GWEI_HOLD_THRESHOLD) {
      gate_decision = "HOLD";
      reasons.push(`ETH gas at ${gas_gwei} gwei — above ${CATO_GAS_GWEI_HOLD_THRESHOLD} gwei doctrine threshold`);
    }
    // v0.2.2: SOFR 1-day delta trigger (funding-market shock detector)
    if (sofr_delta_bps !== null && sofr_delta_bps !== undefined && sofr_delta_bps > CATO_SOFR_DELTA_HOLD_BPS) {
      gate_decision = "HOLD";
      reasons.push(`SOFR 1-day move of ${sofr_delta_bps.toFixed(1)} bps exceeds ${CATO_SOFR_DELTA_HOLD_BPS} bps doctrine threshold (funding-market shock indicator)`);
    }
    if (gate_decision === "HOLD") {
      recommended_rail = "traditional";
    } else {
      // Wording per a2fbf83 accuracy pass (read-only advisory framing).
      reasons.push("All doctrine thresholds clear — no stress or congestion impediments detected");
      recommended_rail = "atomic";
    }
  }

  return { gate_decision, reasons, recommended_rail };
}

/**
 * Cheapest-wins chain picker (PROCEED case only). Mirrors the Python
 * twin's _pick_recommended_chain — same keys, same priority order:
 *   1. Solana if fee_usd_estimate < $0.01
 *   2. Base   if base gas_gwei < 1
 *   3. Ethereum if it has live gas data
 *   4. null
 */
function pickRecommendedChain(chainState) {
  const cs = chainState || {};
  const solFee = (cs.solana || {}).fee_usd_estimate;
  const baseGas = (cs.base || {}).gas_gwei;
  const ethGas = (cs.ethereum || {}).gas_gwei;
  if (solFee !== null && solFee !== undefined && solFee < 0.01) return "solana";
  if (baseGas !== null && baseGas !== undefined && baseGas < 1) return "base";
  if (ethGas !== null && ethGas !== undefined) return "ethereum";
  return null;
}

module.exports = {
  CATO_OFR_ESCALATE_THRESHOLD,
  CATO_OFR_HOLD_THRESHOLD,
  CATO_GAS_GWEI_HOLD_THRESHOLD,
  CATO_SOFR_DELTA_HOLD_BPS,
  computeGateDecision,
  pickRecommendedChain,
};
