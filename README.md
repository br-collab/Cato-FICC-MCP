# Cato Sec (`cato_sec`)

> **Claim label: research.**
> This repository is research code. It is not audited, not production-qualified, and
> has never been used to move real money. Every surface that could reach a payment
> rail refuses to by construction. The four labels this programme uses are *research*,
> *experimental*, *validated* and *production-qualified*; all five repositories are at
> the first, and this label changes only when evidence changes it.


Cato Sec is a Model Context Protocol (MCP) server exposing governed FICC market data
and on-chain settlement tooling to AI development workflows.

Built with Anthropic's official `@modelcontextprotocol/sdk`. Stdio transport.
v0.3.2.

## Why "Cato Sec"

Named after Marcus Porcius Cato (Cato the Censor), the Roman senator who
closed every speech, regardless of topic, with the same governance demand.
The naming captures the operating posture: doctrine repeated until applied,
gates that never relax, governance that does not negotiate with convenience.

*Ceterum censeo* — "in any case, I judge" — applied to settlement authority
and pre-trade control.

## What This Server Exposes

23 tools, all read-only — no tool can initiate, route, or release a trade.

### Governance Gates

- `cato_sec` — Pre-settlement DSOR doctrine context: SOFR, 10y, 2y10y spread,
  OFR stress, fed liquidity posture.
- `get_atomic_settlement_gate` — Verana L0 multi-chain doctrine gate. Returns
  `PROCEED` / `HOLD` / `ESCALATE` plus `recommended_chain`.

> **Canonical identity.** The securities and tokenized-settlement gate in this
> repository is `cato_sec`; `get_atomic_settlement_gate` composes it with rail
> state. `CATO-F`,
> in [br-collab/Project-Atreides](https://github.com/br-collab/Project-Atreides)
> (`atreides/rails/cato_f.py`), is a separate in-process gate for the **cash**
> settlement rail; it emits `PROCEED` / `HOLD` / `ESCALATE` with a rail and a
> finality class. The components are designed as counterparts and share the same OFR
> STLFSI4 stress thresholds, but they are different components answering
> different questions on different surfaces. Not interchangeable.

### Settlement Rails

- `compare_settlement_rails` — All-in cost across FICC traditional,
  Ethereum L1, Base, Arbitrum, Solana, XRPL for a given notional. Returns
  ranked table cheapest-to-most-expensive plus a recommended rail.
- `get_tokenized_settlement_context` — Combined ETH gas + SOFR + OFR stress
  into a single posture: `favorable` / `monitor` / `elevated`.
- `get_multichain_gas` — Live gas/fee state across Ethereum, Base, Arbitrum,
  Solana, XRPL, plus the documented `fed_l1` PORTS placeholder.

### On-Chain Pricing

- `get_onchain_prices` — Live ETH, SOL, and XRP USD prices via the CoinGecko
  public API. Used internally by the rail-cost tools; exposed standalone so
  callers can query current spot prices without triggering a full comparison.

### NY Fed Reference Rates

- `get_sofr` — SOFR daily rate history.
- `get_repo_reference_rates` — SOFR, BGCR, TGCR.
- `get_effr` — Effective Federal Funds Rate.
- `get_repo_operations` — Fed open market repo and reverse repo operations.
- `get_term_sofr` — CME Term SOFR 1m / 3m / 6m / 12m via FRED.
- `get_money_market_rates` — Commercial paper, banker acceptances, CDs.
- `get_repo_market_context` — Overnight + term SOFR + reverse repo facility
  usage in one call.

### Treasury Curve

- `get_treasury_yield_curve` — Constant maturity yields 1m → 30y, full curve
  or a specific tenor.
- `get_tips_yields` — TIPS real yields and breakeven inflation.
- `get_treasury_auctions` — Auction results, bid-to-cover ratios, indirect
  bidder participation.
- `get_yield_curve_spread` — 2y10y, 3m10y, 5y30y spreads in basis points.

### Macro Regime

- `get_macro_regime_snapshot` — Single-call regime: fed funds, SOFR, 10y,
  2y10y, CPI YoY, unemployment.
- `get_cpi` — Headline and core CPI.
- `get_fed_balance_sheet` — Total assets, Treasury holdings, MBS, reserve
  balances.
- `get_ofr_stress_index` — OFR Financial Stress Index composite.

### SEC EDGAR

- `get_recent_13f_filers` — Recent institutional holdings filings.
- `get_company_filings` — Company-specific filings by CIK.

Data sources, all free and no auth required for core functionality: NY Fed,
FRED (optional API key for higher rate limits), TreasuryDirect, OFR,
SEC EDGAR, Blockscout, Solana RPC, XRPL JSON-RPC (xrplcluster.com with
s1.ripple.com fallback), CoinGecko.

## Installation

Requires Node.js 18+.

```bash
git clone https://github.com/br-collab/Cato-FICC-MCP.git
cd Cato-FICC-MCP
npm install
```

## Running

Add to your `~/.claude.json` under `mcpServers`:

```json
{
  "cato_sec": {
    "type": "stdio",
    "command": "node",
    "args": ["/absolute/path/to/Cato-FICC-MCP/index.js"]
  }
}
```

Claude Desktop uses the same JSON shape under `mcpServers` in
`~/Library/Application Support/Claude/claude_desktop_config.json`.

For higher FRED throughput, add `"env": { "FRED_API_KEY": "<key>" }` to the
block above. A free key is available at
https://fred.stlouisfed.org/docs/api/api_key.html. The server runs without
one at reduced rate limits.

## Architecture

Cato Sec sits as the FICC market data and settlement-rail interface beneath
Aureon's broader pre-trade governance platform.

```
        Aureon (pre-trade governance platform)
                       |
                       v
              Verana L0 (control & boundary layer)
                       |
                       v
           Cato Sec (FICC MCP server)
                       |
       +---------------+---------------+
       |               |               |
       v               v               v
   NY Fed         Treasury / OFR    On-chain
   (SOFR, EFFR,   (curve, TIPS,    (multi-chain
    repo, ops)     auctions,        gas, tokenized
                   stress idx)      settlement)
```

Cato Sec is the Verana L0 data layer of the Aureon Decision System of Record
(DSOR) — a pre-trade governance platform where agents advise and operators
decide. The server exposes read-only market data and deterministic governance
gate evaluations; no tool can initiate, route, or release a settlement. The
doctrine emitted here (`PROCEED` / `HOLD` / `ESCALATE`, plus a
`recommended_chain`) is advisory input to a human authority gate (CAOM-001),
not an execution path. Related decision logic is implemented independently
here in JavaScript and inside Aureon in Python
(`aureon/mcp/cato_client.py`). Identical decisions for identical inputs are a
compatibility target, not a current property. The audit compares golden vectors
and detects undeclared drift; it does not prove that production inputs or all
outputs are equivalent.

**Current compatibility status: INCOMPATIBLE.**
[`COMPATIBILITY_STATUS.json`](COMPATIBILITY_STATUS.json) is the machine-readable
source of truth. It records the open XRPL decision-output difference and the
different production stress series. A CI test fails if the published claim is
made greener while either difference remains unresolved.

**Current compatibility detail** (verified 22 Sep 2026):

- **XRPL routing (v0.3.0) — diverges.** This server's chain picker prefers
  XRPL when its fee is under $0.01; the Python twin has no XRPL branch. On the
  same chain state (XRPL fee $0.00003, Solana $0.0004, Base 0.01 gwei,
  Ethereum 0.5 gwei) this server recommends `xrpl` and the twin recommends
  `solana`. The mirror spec is `PARITY_XRPL.md`; it has not landed. Tracked in
  [br-collab/aureon#9](https://github.com/br-collab/aureon/issues/9).
- **Unusable stress reading (v0.3.1) — production inputs still differ.** A NaN,
  infinite, malformed or missing STLFSI4 observation holds this server's gate.
  In aureon the Python implementation is instead handed a finite proxy when its
  source is unavailable, so its usability guard does not see an absent reading.
  The original finding is recorded in
  [br-collab/aureon#12](https://github.com/br-collab/aureon/issues/12).
- **Stress index (all versions) — inputs diverge in production.** The Node
  gate reads FRED STLFSI4; the Python twin and the pre-trade policy engine
  read the OFR Financial Stress Index, or a proxy computed from VIX,
  high-yield spreads and the yield curve when that feed is unavailable. The
  golden vectors supply identical inputs to both sides, so parity holds
  under test; in production the two are fed different series, and the
  0.5/1.0 thresholds were backtested on STLFSI4 only. Tracked in
  [br-collab/aureon#11](https://github.com/br-collab/aureon/issues/11).
- **How it is checked.** `parity/run_parity.py` in
  [br-collab/aureon](https://github.com/br-collab/aureon) drives this
  repository's `gate_core.js` against the twin on 17 golden vectors. Sixteen
  pass. The seventeenth, V17, reproduces the XRPL divergence above and is
  marked KNOWN-FAILING: it is reported on every run, and the build fails if it
  starts passing before its marker is removed. The harness runs in CI in both
  repositories (`.github/workflows/parity.yml`), added in
  [`63addba`](https://github.com/br-collab/Cato-FICC-MCP/commit/63addba7361e30c20d9efab968ae5000a1b81785) here and
  [`810b9b3`](https://github.com/br-collab/aureon/commit/810b9b3459f4f79621b6a3d13b8190939069befe) in aureon. It covers only what the vectors
  exercise.

## Routing Doctrine

Settlement-rail routing is deterministic and parameterized by observable
market-state indicators. The router does not learn, adapt, or improvise — it
applies declared rules against current state and produces a routing
recommendation that a human approves before any settlement instruction is
generated.

```
if      OFR stress > 0.5                         → ficc_traditional   (stress overrides everything)
else if |SOFR 1-day delta| > 10 bps              → ficc_traditional   (funding-market shock override)
else if notional > $10M  and  eth_gas < 30 gwei  → ethereum_l1        (large notional, gas is noise)
else if xrpl_fee_usd < $0.01                     → xrpl               (ultra-low cost + deterministic ~4s finality)
else if solana_fee_usd < $0.01                   → solana             (ultra-low cost, probabilistic-speed tier)
else if base_gas < 1 gwei                        → base               (L2 default when available)
else if eth_gas > 50 gwei                        → ficc_traditional   (gas spike fallback)
else                                             → ethereum_l1        (safe default)
```

**v0.3.0 doctrine event — why XRPL outranks Solana.** At equal near-zero
cost the router prefers certainty of finality over raw speed. An XRPL
transaction in a validated ledger is final — consensus validation is
deterministic, with no probabilistic confirmation window — at a ~4s ledger
close and a fee of typically 10-15 drops (~$0.00003). Solana is 10× faster
(400ms) but carries the 2022-2023 outage history already flagged in Cato Sec's
`solana_note`. For institutional DvP settlement, 3.6 seconds is noise;
finality certainty is not. XRPL's own incident record (one 64-minute
consensus stall, Feb 4-5, 2025, no loss of user assets) is disclosed in
`xrpl_note` — the preference is earned on the merits, not granted by
exemption. Per the parity principle, this doctrine change requires a
mirrored change to the Python twin (`aureon/mcp/cato_client.py`), specified
in `PARITY_XRPL.md`. **That mirror has not landed** — the twin diverges at
this step of the chain picker; see *Current parity status* under Architecture.

### Settlement Rails

| Rail | Speed | Cost | Status |
|------|-------|------|--------|
| **FICC traditional** | T+1 | ~0.5 bps clearing fee net of 40% netting benefit + SOFR cost-of-capital | Live |
| **Ethereum L1** | ~12s | Variable gwei, fetched from `eth.blockscout.com` | Live |
| **Base** (Ethereum L2) | ~2s | ~0.01 gwei, fetched from `base.blockscout.com` | Live |
| **Arbitrum** (Ethereum L2) | ~2s | ~0.02 gwei, fetched from `arbitrum.blockscout.com` | Live |
| **Solana** | ~400ms | ~$0.001 per settlement, `getRecentPrioritizationFees` via public RPC | Experimental |
| **XRPL** | ~4s (deterministic finality) | ~10-15 drops ≈ $0.00003, `fee` method via public JSON-RPC | Live (v0.3.0) |
| **Fed L1 / PORTS** | Instant | TBD | Not yet issued (hypothetical) |

### Cost model — a parameterized proxy, not clearing economics

FICC traditional cost is a declared proxy. It applies a 0.5 bps clearing fee
against notional net of an assumed 40% netting benefit, annualized to the
term, plus SOFR cost-of-capital for the term. The 40% figure is a declared
assumption, not a published FICC statistic and not an estimate of FICC's
actual netting efficiency. The parameter exists to make the traditional rail's
cost explicit and adjustable, not to predict it. Note the direction: if actual
netting efficiency exceeds 40%, this overstates FICC cost and biases the
comparison against the traditional rail.

Both parameters are returned in the `inputs` field of every
`compare_settlement_rails` response, so a caller can always see what produced a
ranking. They are constants in `index.js` (`FICC_CLEARING_FEE_BPS`,
`FICC_NETTING_BENEFIT_PCT`), applied in `ficcCost` and echoed in that `inputs`
field — parameters, not findings. Change them and the ranking moves. The
Python twin carries the same two constants in `aureon/mcp/cato_client.py`.

What this server does **not** model: Value-at-Risk-based clearing fund margin,
the capped contingency liquidity facility, or netting resolved at instrument
level.

> **Cato Sec is chain-agnostic by design. The governance gate — not the rail — is the product. The doctrine doesn't change when a new rail is added. The rail does.**

### Fed L1 / PORTS notes

The `fed_l1` slot is a documented, non-functional placeholder. Tokenized Federal
Reserve reserves do not exist and remain hypothetical. The GENIUS Act (enacted
July 2025) governs privately issued payment stablecoins, not central-bank money.
**Cato Sec has the slot ready now.** The doctrine doesn't change when a new rail is
added; the rail does.

## Academic Foundation

Cato Sec's rail comparison framework is grounded in published economic research
on tokenized Treasury settlement:

- **Duffie, D. & Wilson, D. R. (2025).** *The case for a new floating rate Treasury note.* Brookings Institution (Dec 2025). Proposes Perpetual Overnight Rate Treasury Securities (PORTS).
- **Duffie, D. (2025).** *How US Treasuries Can Remain the World's Safe Haven.* Journal of Economic Perspectives. Dealer-balance-sheet research; not a tokenization proposal.

## Security

See `SECURITY_NOTES.md` for the current supply-chain audit posture, including
the hono CVE reachability analysis (GHSA-458j-xx4x-4375, inherited
transitively via `@modelcontextprotocol/sdk`, unreachable in Cato Sec's stdio
code path).

## Related Projects

- [br-collab/aureon](https://github.com/br-collab/aureon) — the broader
  pre-trade governance platform this MCP server integrates into.

## License

MIT.

---

*Project Aureon · Ravelo Strategic Solutions LLC · Columbia University M.S. Technology Management*
