# PARITY_XRPL.md — Python-twin mirror for the v0.3.0 xrpl doctrine event

Per the Parity Principle (gate_core.js header; Grid 3 CLAUDE.md), any change
to the decision core is a doctrine event and must be mirrored in the
in-process Python twin (`aureon/mcp/cato_client.py` in `br-collab/aureon`)
in the same change set. This note is the mirror spec for v0.3.0. The Node
side is already live; the twin diverges until these land.

## What changed on the Node side

1. `pickRecommendedChain(chainState)` — new first branch: return `"xrpl"`
   when `chainState.xrpl.fee_usd_estimate < 0.01`, checked BEFORE the
   solana branch. Priority order is now: xrpl → solana → base → ethereum
   → null.
2. New named doctrine constant `CATO_ULTRA_LOW_FEE_USD = 0.01` (was an
   inline literal in the solana branch).
3. `compare_settlement_rails` routing: new branch
   `xrpl_fee_usd < 0.01 → "xrpl"` inserted between the large-notional
   ethereum_l1 branch and the solana branch.
4. Gate doctrine string bumped: `"Verana L0 — Cato settlement gate v0.3.0"`.
5. `computeGateDecision` is UNCHANGED — thresholds, reasons strings, and
   PROCEED/HOLD/ESCALATE logic are byte-identical to v0.2.3. Only the
   chain/rail pickers changed.

## Required changes in aureon/mcp/cato_client.py

### `_pick_recommended_chain`

```python
CATO_ULTRA_LOW_FEE_USD = 0.01  # doctrine constant, mirrors gate_core.js

def _pick_recommended_chain(chain_state: dict) -> str | None:
    cs = chain_state or {}
    xrpl_fee = (cs.get("xrpl") or {}).get("fee_usd_estimate")
    sol_fee = (cs.get("solana") or {}).get("fee_usd_estimate")
    base_gas = (cs.get("base") or {}).get("gas_gwei")
    eth_gas = (cs.get("ethereum") or {}).get("gas_gwei")
    if xrpl_fee is not None and xrpl_fee < CATO_ULTRA_LOW_FEE_USD:   # v0.3.0
        return "xrpl"
    if sol_fee is not None and sol_fee < CATO_ULTRA_LOW_FEE_USD:
        return "solana"
    if base_gas is not None and base_gas < 1:
        return "base"
    if eth_gas is not None:
        return "ethereum"
    return None
```

### Doctrine string

Wherever the twin emits `"Verana L0 — Cato settlement gate v0.2.3"`,
emit `"Verana L0 — Cato settlement gate v0.3.0"`.

### If the twin also mirrors compare_settlement_rails routing

Insert, between the large-notional branch and the solana branch:

```python
elif xrpl_fee_usd is not None and xrpl_fee_usd < CATO_ULTRA_LOW_FEE_USD:
    recommended_rail = "xrpl"
```

### Chain-state input shape

The twin's chain_state dict gains a key:

```python
"xrpl": {
    "fee_drops": int,              # max(open_ledger_fee, base_fee)
    "fee_usd_estimate": float,     # fee_drops * 1e-6 * xrp_price_usd
    "base_fee_drops": int,
    "open_ledger_fee_drops": int,
    "settlement_speed": "4s",
    "status": "live" | "placeholder",
}
```

## Golden vectors to add to parity/run_parity.py

Decision vectors (computeGateDecision) are unchanged — existing vectors
must still pass byte-for-byte. Add picker vectors:

| # | chain_state (abridged) | expected |
|---|---|---|
| P1 | xrpl.fee_usd=0.00003, solana.fee_usd=0.0008, base.gas=0.01, eth.gas=20 | `xrpl` |
| P2 | xrpl.fee_usd=0.02 (escalated open-ledger fee), solana.fee_usd=0.0008 | `solana` |
| P3 | xrpl absent (old chain_state shape), solana.fee_usd=0.0008 | `solana` (backwards compat) |
| P4 | xrpl.fee_usd=None, solana.fee_usd=None, base.gas=0.5 | `base` |
| P5 | all fees None/absent, eth.gas=25 | `ethereum` |
| P6 | all None/absent | `None` |

## Doctrine rationale (for the record)

At equal near-zero cost the picker prefers deterministic finality over raw
speed: an XRPL transaction in a validated ledger is final (consensus
validation, no probabilistic confirmation window) at ~4s ledger close and
~10-15 drops (~$0.00003). Solana's 400ms advantage carries the 2022-2023
outage history already flagged in solana_note. XRPL's own record includes
one 64-minute consensus stall (Feb 4-5, 2025, no loss of user assets),
disclosed in xrpl_note — the preference is on the merits, not an exemption.
For institutional DvP, 3.6 seconds is noise; finality certainty is not.
