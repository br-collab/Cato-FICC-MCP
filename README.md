# cato-ficc-mcp

A Model Context Protocol (MCP) server exposing governed FICC market data
and on-chain settlement tooling to AI development workflows.

Built with Anthropic's official `@modelcontextprotocol/sdk`. Stdio transport.
v0.2.3.

## Why "Cato"

Named after Marcus Porcius Cato (Cato the Censor), the Roman senator who
closed every speech, regardless of topic, with the same governance demand.
The naming captures the operating posture: doctrine repeated until applied,
gates that never relax, governance that does not negotiate with convenience.

*Ceterum censeo* — "in any case, I judge" — applied to settlement authority
and pre-trade control.

## What This Server Exposes

23 tools, all read-only — no tool can initiate, route, or release a trade.

### Governance Gates

- `cato_gate` — Pre-settlement DSOR doctrine context: SOFR, 10y, 2y10y spread,
  OFR stress, fed liquidity posture.
- `get_atomic_settlement_gate` — Verana L0 multi-chain doctrine gate. Returns
  `PROCEED` / `HOLD` / `ESCALATE` plus `recommended_chain`.

### Settlement Rails

- `compare_settlement_rails` — All-in cost across FICC traditional,
  Ethereum L1, Base, Arbitrum, Solana for a given notional. Returns ranked
  table cheapest-to-most-expensive plus a recommended rail.
- `get_tokenized_settlement_context` — Combined ETH gas + SOFR + OFR stress
  into a single posture: `favorable` / `monitor` / `elevated`.
- `get_multichain_gas` — Live gas/fee state across Ethereum, Base, Arbitrum,
  Solana, plus the documented `fed_l1` PORTS placeholder.

### On-Chain Pricing

- `get_onchain_prices` — Live ETH and SOL USD prices via the CoinGecko public
  API. Used internally by the rail-cost tools; exposed standalone so callers
  can query current spot prices without triggering a full comparison.

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
SEC EDGAR, Blockscout, CoinGecko.

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
  "cato": {
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

Cato sits as the FICC market data and settlement-rail interface beneath
Aureon's broader pre-trade governance platform.

```
        Aureon (pre-trade governance platform)
                       |
                       v
              Verana L0 (control & boundary layer)
                       |
                       v
              Cato (FICC MCP server)
                       |
       +---------------+---------------+
       |               |               |
       v               v               v
   NY Fed         Treasury / OFR    On-chain
   (SOFR, EFFR,   (curve, TIPS,    (multi-chain
    repo, ops)     auctions,        gas, tokenized
                   stress idx)      settlement)
```

Cato is the Verana L0 data layer of the Aureon Decision System of Record
(DSOR) — a pre-trade governance platform where agents advise and operators
decide. The server exposes read-only market data and deterministic governance
gate evaluations; no tool can initiate, route, or release a settlement. The
doctrine emitted here (`PROCEED` / `HOLD` / `ESCALATE`, plus a
`recommended_chain`) is advisory input to a human authority gate (CAOM-001),
not an execution path. The same doctrine is implemented twice — once here in
JavaScript as a public MCP server, and once inside Aureon as an in-process
Python twin — and both implementations are required to produce bit-for-bit
identical decisions for identical inputs. The parity is what lets the gate
be relied on regardless of caller.

## Routing Doctrine

Settlement-rail routing is deterministic and parameterized by observable
market-state indicators. The router does not learn, adapt, or improvise — it
applies declared rules against current state and produces a routing
recommendation that a human approves before any settlement instruction is
generated.

```
if      OFR stress > 0.5                         → ficc_traditional   (stress overrides everything)
else if notional > $10M  and  eth_gas < 30 gwei  → ethereum_l1        (large notional, gas is noise)
else if solana_fee_usd < $0.01                   → solana             (ultra-low cost at any size)
else if base_gas < 1 gwei                        → base               (L2 default when available)
else if eth_gas > 50 gwei                        → ficc_traditional   (gas spike fallback)
else                                             → ethereum_l1        (safe default)
```

### Settlement Rails

| Rail | Speed | Cost | Status |
|------|-------|------|--------|
| **FICC traditional** | T+1 | ~0.5 bps clearing fee net of 40% netting benefit + SOFR cost-of-capital | Live |
| **Ethereum L1** | ~12s | Variable gwei, fetched from `eth.blockscout.com` | Live |
| **Base** (Ethereum L2) | ~2s | ~0.01 gwei, fetched from `base.blockscout.com` | Live |
| **Arbitrum** (Ethereum L2) | ~2s | ~0.02 gwei, fetched from `arbitrum.blockscout.com` | Live |
| **Solana** | ~400ms | ~$0.001 per settlement, `getRecentPrioritizationFees` via public RPC | Experimental |
| **Fed L1 / PORTS** | Instant | TBD | Not yet issued (hypothetical) |

> **Cato is chain-agnostic by design. The governance gate — not the rail — is the product. The doctrine doesn't change when a new rail is added. The rail does.**

### Fed L1 / PORTS notes

The `fed_l1` slot is a documented, non-functional placeholder. Tokenized Federal
Reserve reserves do not exist and remain hypothetical. The GENIUS Act (enacted
July 2025) governs privately issued payment stablecoins, not central-bank money.
**Cato has the slot ready now.** The doctrine doesn't change when a new rail is
added; the rail does.

## Academic Foundation

Cato's rail comparison framework is grounded in published economic research
on tokenized Treasury settlement:

- **Duffie, D. & Wilson, D. R. (2025).** *The case for a new floating rate Treasury note.* Brookings Institution (Dec 2025). Proposes Perpetual Overnight Rate Treasury Securities (PORTS).
- **Duffie, D. (2025).** *How US Treasuries Can Remain the World's Safe Haven.* Journal of Economic Perspectives. Dealer-balance-sheet research; not a tokenization proposal.

## Security

See `SECURITY_NOTES.md` for the current supply-chain audit posture, including
the hono CVE reachability analysis (GHSA-458j-xx4x-4375, inherited
transitively via `@modelcontextprotocol/sdk`, unreachable in Cato's stdio
code path).

## Related Projects

- [br-collab/aureon](https://github.com/br-collab/aureon) — the broader
  pre-trade governance platform this MCP server integrates into.

## License

MIT.

---

*Project Aureon · Ravelo Strategic Solutions LLC · Columbia University M.S. Technology Management*
