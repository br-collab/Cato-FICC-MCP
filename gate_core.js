/**
 * gate_core.js — Cato Sec decision core (pure, no I/O)
 * =================================================
 * WS-0.2 (AUR-ROADMAP-001): the external Node MCP server and the in-process
 * Python implementation target the same decisions for identical inputs.
 * Compatibility currently has declared gaps (COMPATIBILITY_STATUS.json); it drifted
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
 * and parity/run_parity.py drives it with golden vectors. That audit detects
 * undeclared drift but is not a compatibility certification. Any change
 * to this file is a doctrine event (Cato Sec thresholds are doctrine, not
 * configuration) and must be mirrored in the Python twin in the same
 * change set.
 *
 * No dependencies. CommonJS, matching index.js.
 */

// Doctrine thresholds (Duffie 2025, Brookings; Cato Sec v0.2.2 backtest).
const CATO_OFR_ESCALATE_THRESHOLD = 1.0;
const CATO_OFR_HOLD_THRESHOLD = 0.5;
const CATO_GAS_GWEI_HOLD_THRESHOLD = 50.0;
const CATO_SOFR_DELTA_HOLD_BPS = 10.0; // funding-market shock detector
// v0.3.0: ultra-low-cost threshold shared by the XRPL and Solana picker
// branches. Was an inline 0.01 literal in v0.2.x; named here because the
// xrpl rail reuses it and doctrine constants must have one home.
const CATO_ULTRA_LOW_FEE_USD = 0.01;
// Settlement-posture bands for get_tokenized_settlement_context — named
// to match the Python twin's CATO_POSTURE_* constants (cato_client.py).
// There is no doctrine "monitor" gas threshold independent of this one;
// it exists so the posture tool can show an early-warning band ahead of
// the hard HOLD_THRESHOLD, and it must have the same one home every
// other doctrine constant does.
const CATO_POSTURE_MONITOR_GAS = 30.0;

/**
 * True only for a real, finite number — the one shape a systemic-stress
 * reading must have to be usable. NaN (e.g. parseFloat(".") on a FRED
 * "missing observation" marker), +/-Infinity, null, undefined, and
 * non-numeric types all fail this. A caller must never default a failed
 * check here to a value that reads as "clear" (see 2026-08-21 audit: a
 * missing OFR reading silently cleared the gate via `?? "0"`).
 */
function isUsableStressReading(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * One FRED observation — or its absence — to a stress reading. A failed
 * fetch leaves no observation, which yields null; a present value is
 * parsed as-is, so FRED's "." marker still yields NaN. Both then fail
 * isUsableStressReading and HOLD. It never substitutes a number for a
 * reading it does not have: the gate handler's `value ?? "0"` turned a
 * FRED outage into PROCEED / "All doctrine thresholds clear"
 * (br-collab/aureon#12).
 */
function stressReadingFromObservation(observation) {
  const raw = observation ? observation.value : undefined;
  return raw !== undefined && raw !== null ? parseFloat(raw) : null;
}

/**
 * Pure Cato Sec gate decision. Inputs:
 *   ofr_stress     — OFR STLFSI4 value; must be a finite number to be
 *                    usable (see isUsableStressReading). An unusable
 *                    reading HOLDs — it never falls through to PROCEED.
 *   gas_gwei       — ETH L1 gas in gwei, or null/undefined if unavailable
 *   sofr_delta_bps — |SOFR(t) − SOFR(t−1)| × 100, or null if unavailable
 */
function computeGateDecision({ ofr_stress, gas_gwei, sofr_delta_bps }) {
  const reasons = [];
  let gate_decision = "PROCEED";
  let recommended_rail = "atomic";

  // Check 0 — the reading has to exist before it can be measured against
  // anything. NaN and +/-Infinity fail every comparison below, which is
  // exactly how a missing feed used to clear the gate silently.
  if (!isUsableStressReading(ofr_stress)) {
    return {
      gate_decision: "HOLD",
      reasons: [
        `OFR stress reading is not a usable number (got ${JSON.stringify(ofr_stress)}) — ` +
          "feed missing or malformed; holding rather than assuming clear",
      ],
      recommended_rail: "traditional",
    };
  }

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
 * Chain picker (PROCEED case only). Mirrors the Python twin's
 * _pick_recommended_chain — same keys, same priority order:
 *   1. XRPL   if fee_usd_estimate < $0.01   (v0.3.0 — see doctrine note)
 *   2. Solana if fee_usd_estimate < $0.01
 *   3. Base   if base gas_gwei < 1
 *   4. Ethereum if it has live gas data
 *   5. null
 *
 * DOCTRINE EVENT (v0.3.0): xrpl slots ABOVE solana. At equal near-zero
 * cost the picker prefers deterministic finality over raw speed: an XRPL
 * ledger close (~4s) is final when validated — no probabilistic
 * confirmation window — while Solana's 400ms edge carries the 2022-2023
 * outage history already flagged in Cato Sec's own solana_note (plus the
 * 64-minute consensus stall XRPL itself logged on Feb 4-5, 2025, which
 * is why XRPL gets a preference, not an exemption from doctrine). For
 * institutional DvP settlement, certainty of finality is worth more than
 * 3.6 seconds. This changes recommended_chain output whenever both XRPL
 * and Solana are live and ultra-cheap — the Python twin MUST take the
 * mirrored change in the same change set (see PARITY_XRPL.md).
 */
function pickRecommendedChain(chainState) {
  const cs = chainState || {};
  const xrplFee = (cs.xrpl || {}).fee_usd_estimate;
  const solFee = (cs.solana || {}).fee_usd_estimate;
  const baseGas = (cs.base || {}).gas_gwei;
  const ethGas = (cs.ethereum || {}).gas_gwei;
  if (xrplFee !== null && xrplFee !== undefined && xrplFee < CATO_ULTRA_LOW_FEE_USD) return "xrpl";
  if (solFee !== null && solFee !== undefined && solFee < CATO_ULTRA_LOW_FEE_USD) return "solana";
  if (baseGas !== null && baseGas !== undefined && baseGas < 1) return "base";
  if (ethGas !== null && ethGas !== undefined) return "ethereum";
  return null;
}

module.exports = {
  CATO_OFR_ESCALATE_THRESHOLD,
  CATO_OFR_HOLD_THRESHOLD,
  CATO_GAS_GWEI_HOLD_THRESHOLD,
  CATO_SOFR_DELTA_HOLD_BPS,
  CATO_ULTRA_LOW_FEE_USD,
  CATO_POSTURE_MONITOR_GAS,
  isUsableStressReading,
  stressReadingFromObservation,
  computeGateDecision,
  pickRecommendedChain,
};
