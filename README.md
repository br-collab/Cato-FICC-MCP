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
v0.5.0. The current research implementation exposes 29 read-only MCP tools and the narrow
pure-core compatibility surface documented below. Its measured suite passes **21 doctrine
vectors plus 5 boundary/claim assertion scripts**; `gate_core.js` measures **69.69% branch,
99.42% statement, 100% function, and 99.42% line coverage**. It does not submit, route, release,
or settle a trade; model Value at Risk-based clearing-fund margin, liquidity add-ons, or
participant-default waterfalls; or erase the two declared Node/Python compatibility gaps.

## Why "Cato Sec"

Named after Marcus Porcius Cato (Cato the Censor), the Roman senator who
closed every speech, regardless of topic, with the same governance demand.
The naming captures the operating posture: doctrine repeated until applied,
gates that never relax, governance that does not negotiate with convenience.

*Ceterum censeo* — "in any case, I judge" — applied to settlement authority
and pre-trade control.

## What This Server Exposes

29 tools, all read-only — no tool can initiate, route, or release a trade.

### Public API

The supported external interface is the `cato_sec` stdio executable and the
29 MCP tools listed below. Install the package and start it with `cato_sec`,
`npm start`, or `node index.js`; MCP clients should discover and call tools
through the protocol rather than import implementation functions from
`index.js`. Executing `index.js` starts the server; requiring it is side-effect
free and exports no JavaScript library API. The package export map deliberately
has no root library export, so package consumers cannot accidentally treat the
executable as a second API.

The `cato-sec-mcp/gate-core` compatibility subpath (implemented by
`gate_core.js`) is the one importable CommonJS module. It is a narrow,
I/O-free decision surface used by this repository's tests and Aureon's parity
harness. It exports:

- `computeGateDecision` and `pickRecommendedChain`, the deterministic gate and
  chain-selection functions;
- `isUsableStressReading` and `stressReadingFromObservation`, the stress-input
  validation helpers; and
- the six `CATO_*` doctrine constants used by those decisions.

Those exports are a compatibility and verification surface, not a second MCP
entry point. New integrations should use the MCP tools unless they specifically
need to test the pure doctrine functions with supplied inputs. All other
functions, constants, caches, handlers, and data-source clients in `index.js`
are implementation details and may change without forming a package-level API.

### Governance Gates

- `cato_sec` — Pre-settlement DSOR doctrine context: SOFR, 10y, 2y10y spread,
  St. Louis Fed stress, fed liquidity posture.
- `get_atomic_settlement_gate` — Verana L0 multi-chain doctrine gate. Returns
  `PROCEED` / `HOLD` / `ESCALATE` plus `recommended_chain`.

> **Canonical identity.** The securities and tokenized-settlement gate in this
> repository is `cato_sec`; `get_atomic_settlement_gate` composes it with rail
> state. `CATO-F`,
> in [br-collab/Project-Atreides](https://github.com/br-collab/Project-Atreides)
> (`atreides/rails/cato_cash.py`), is a separate in-process gate for the **cash**
> settlement rail; it emits `PROCEED` / `HOLD` / `ESCALATE` with a rail and a
> finality class. The components are designed as counterparts and share the same OFR
> STLFSI4 stress thresholds, but they are different components answering
> different questions on different surfaces. Not interchangeable.

### Settlement Rails

- `compare_settlement_rails` — All-in cost across FICC traditional,
  Ethereum L1, Base, Arbitrum, Solana, XRPL for a given notional. Returns
  ranked table cheapest-to-most-expensive plus a recommended rail.
- `get_tokenized_settlement_context` — Combined ETH gas + SOFR + St. Louis Fed stress
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
- `get_money_market_rates` — Commercial paper, banker acceptances, CDs.
- `get_cleared_repo_segments` — OFR STFM FICC DVP, FICC GCF, and tri-party
  preliminary average rates and transaction volumes with series IDs and dates.
- `get_repo_market_context` — Those cleared segments beside NY Fed SOFR, BGCR,
  and TGCR observations, including their published percentiles and volumes.
  Unavailable sources are labelled unavailable, never presented as current.

### Sections and admission

A section is admitted only when all three tests pass: the data may be redistributed,
a governance gate exists, and a named consumer exists. “Publicly visible” is not a
license. Cato does not store, cache, archive, or republish FRED API content; it makes
live requests only and returns one response to the caller. The cancelled
`fred_historical_ingest`/ArcticDB plan is not part of this server.

| Section | Source | License basis | Gate | Named consumer | Status |
|---|---|---|---|---|---|
| Treasury rates and auctions | U.S. Treasury XML and Fiscal Data | U.S. government works; public APIs | Cato Sec | Aureon and Atreides | Admitted |
| NY Fed reference rates | NY Fed Markets API | NY Fed Terms of Use permit use, copying and distribution with the required notice | Cato Sec | Aureon and Atreides | Admitted |
| Repo | OFR STFM API | OFR calls it an open public interface requiring no token or registration | Cato Sec / Cato Cash | Aureon and Atreides | Admitted |
| OFR Financial Stress Index | OFR daily publication | U.S. government work, subject to OFR's third-party-data disclaimer | Informational only; the existing gate continues to use STLFSI4 | Aureon research | Admitted as context, not a gate input |
| SEC fails to deliver | SEC twice-monthly files | U.S. government work | Atreides Rule 204 controls | Atreides CNS fails checks | Admitted as market context |
| Party identity | GLEIF API | CC0 1.0 via the required API Access Service | Account-master identity controls | Attested crossings and account master | Admitted |
| Instrument identity | OpenFIGI API | FIGI identifiers dedicated to the public domain; no CUSIP database is stored or published | Fixture admission controls | OMS-1 / EQ-1 fixtures | Admitted |
| Sanctions | Treasury OFAC Sanctions List Service | U.S. government work | Account-master sanctions control | Account master | Admitted as exact-name advisory screening |
| Digital assets | CoinGecko public API and public rail RPCs | Public API use with attribution; no redistribution claim beyond the live response | Atomic-settlement gate | Aureon | Admitted |
| FRED residual series | FRED API, only when FRED owns the series or no primary feed is admitted | Live pass-through under FRED API terms; no cache/archive | Cato Sec where named | Aureon research | Admitted only per named tool |
| FINRA short sale, short interest, TRACE | FINRA | Terms limit use and prohibit redistribution without written consent | — | — | Not admitted: license test fails |
| CME Term SOFR | CME Group | Distribution requires a CME license | — | — | Not admitted: license test fails; `get_term_sofr` is removed |
| Bloomberg | Bloomberg | Academic access is educational only and excludes development use | — | — | Not admitted: license test fails |
| Nasdaq / NYSE Reg SHO threshold lists | Exchange publications | Redistribution permission has not been confirmed | — | — | Not admitted: license test is indeterminate |

Required notices carried by the affected tool responses and this README:

- **FRED:** “This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.”
- **New York Fed reference rates:** “The reference rate data are subject to the Terms of Use posted at newyorkfed.org. The New York Fed is not responsible for publication of the reference rate data by Cato Sec, does not sanction or endorse any particular republication, and has no liability for your use.”
- **CoinGecko:** Price data provided by CoinGecko.

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
- `get_ofr_stress_index` — St. Louis Fed Financial Stress Index (`STLFSI4`, via FRED).
- `get_ofr_financial_stress_index` — OFR's own daily Financial Stress Index and components;
  informational and explicitly not substituted into the existing gate.

### SEC EDGAR

- `get_recent_13f_filers` — Recent institutional holdings filings.
- `get_company_filings` — Company-specific filings by CIK.
- `get_sec_fails_to_deliver` — SEC twice-monthly CNS balance by CUSIP. The value is
  an outstanding aggregate balance, not a count of new fails.

### Identity, sanctions, and fiscal data

- `lookup_lei` — GLEIF LEI API lookup through the Access Service.
- `map_cusip_to_figi` — OpenFIGI mapping without creating or publishing a CUSIP database.
- `screen_ofac_sdn` — Exact-name advisory check of OFAC's live SDN CSV; a non-match is
  not sanctions clearance and source failure returns unavailable.
- `get_treasury_average_interest_rates` — Treasury Fiscal Data average-interest-rate records.

Data sources, all free and no auth required for core functionality: NY Fed,
FRED (optional API key for higher rate limits; live and uncached), U.S. Treasury, OFR,
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
(`aureon/mcp/cato_client.py`). The full executable vector set produces identical
decisions. The audit detects decision drift; it does not prove that production
inputs are equivalent.

**Current compatibility status: INCOMPATIBLE.**
[`COMPATIBILITY_STATUS.json`](COMPATIBILITY_STATUS.json) is the machine-readable
source of truth. XRPL decision parity is resolved; the different production
stress series remains open, so overall production compatibility is not claimed.

**Current compatibility detail** (verified 23 Oct 2026):

- **XRPL routing (v0.5.0) — resolved.** Both implementations prefer XRPL
  below the shared ultra-low-fee threshold. V17 now passes without a waiver.
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
  repository's `gate_core.js` against the twin on 17 golden vectors. All 17
  pass, and CI fails on any decision difference. The harness runs in CI in both
  repositories (`.github/workflows/parity.yml`), added in
  [`63addba`](https://github.com/br-collab/Cato-FICC-MCP/commit/63addba7361e30c20d9efab968ae5000a1b81785) here and
  [`810b9b3`](https://github.com/br-collab/aureon/commit/810b9b3459f4f79621b6a3d13b8190939069befe) in aureon. It covers only what the vectors
  exercise.

## Routing Doctrine

Settlement-rail advice applies eligibility before cost. A CUSIP Treasury can
be considered only for the firm's declared FICC/Fedwire entitlements; it is
never compared with a tokenized claim on a chain. A tokenized fund is ranked
only across declared chain entitlements. Every comparison is **ADVISORY, NOT A
CLEARANCE DECISION** and cannot create a settlement instruction.

```
eligible = instrument-exists-on-rail AND declared-membership-or-entitlement
if eligible is empty                              → no recommendation
if CUSIP Treasury                                 → FICC/Fedwire only; never a chain
if tokenized fund                                 → declared chain entitlements only
rank cost only inside eligible
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
in `PARITY_XRPL.md`. That mirror is implemented by aureon GR-1 and V17 passes.

### Settlement Rails

| Rail | Speed | Cost | Status |
|------|-------|------|--------|
| **FICC traditional** | T+1 | Illustrative 0.5 bps/40% proxy plus SOFR cost-of-capital | Live for declared members |
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
