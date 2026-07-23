# Cato — Security Notes

> **Audit artifact.** Created 2026-04-19 from Sam's read-only review of
> Cato during the Aureon doctrine-note phase. Scope: npm audit
> disposition + runtime threat-model reasoning. Cato's code itself is
> not modified by this document.

---

## Open advisory — hono <4.12.14 (moderate)

**First observed:** 2026-04-19 via `npm audit` at Cato commit
corresponding to `index.js` dated 2026-04-14 (v0.2.3).

| Field | Value |
|---|---|
| **Advisory** | GHSA-458j-xx4x-4375 |
| **Package** | `hono` (affected <4.12.14; installed 4.12.12) |
| **Severity** | Moderate |
| **Class** | HTML injection in `hono/jsx` SSR (improperly handles JSX attribute names) |
| **Direct dep?** | **No.** Transitive via `@modelcontextprotocol/sdk@1.29.0` (direct + via `@hono/node-server@1.19.14`). |
| **Referenced in Cato code?** | **No.** `grep -rn "hono" index.js` returns zero matches. |

### Reachability analysis for Cato's use pattern

The vulnerable code path is `hono/jsx` server-side rendering with
user-controlled input flowing into JSX **attribute names**. For that
to be exploitable in a given host application, all of the following
must be true:

1. The host runs an HTTP server (or similar request-response surface)
   that accepts external input.
2. The host uses `hono/jsx` to render HTML.
3. Untrusted input reaches the JSX attribute-name position during
   that render.

**None of these hold for Cato.** Specifically:

- **Transport:** stdio only (`StdioServerTransport`, index.js line 32).
  Cato does not bind any HTTP port. It communicates with its MCP
  client over process stdin/stdout exclusively.
- **HTML rendering:** none. Cato returns structured JSON as the
  response body of every MCP tool call. It does not render HTML or
  JSX anywhere.
- **User input surface:** MCP tool arguments from the LLM client are
  structured JSON, validated against each tool's `inputSchema`. They
  never flow into JSX attribute names because there is no JSX.
- **Outbound calls:** `axios.get` against a fixed allowlist of public
  APIs (NY Fed, FRED, TreasuryDirect, OFR, SEC EDGAR, Blockscout
  endpoints, Solana RPC, CoinGecko). No response data is rendered
  as HTML.

The hono package is present on disk because the MCP SDK pulls it in
transitively — presumably for its HTTP-transport servers, which Cato
does not use. It is dead weight for Cato's runtime.

### Operator rule applied

Per 2026-04-19 directive: transitive dependencies whose vulnerable
code paths are unreachable given Cato's use pattern (read-only API
calls, no inbound HTTP, no user-input parsing beyond schema-validated
MCP args, no authentication handling) are **documented and monitored,
not fixed**. Fixing requires either upgrading the MCP SDK to a version
that pins a patched hono, or running `npm audit fix` which would
attempt a hono bump in-place.

### Disposition

**Status:** Monitored, not remediated.
**Re-evaluation triggers:**
- Cato adopts an HTTP transport (SSE, WebSocket, or HTTP server
  variant of the MCP SDK).
- Cato begins rendering any HTML or JSX output.
- Advisory severity is raised to High or Critical.
- `@modelcontextprotocol/sdk` releases a version that bundles a
  patched hono, at which point `npm update @modelcontextprotocol/sdk`
  resolves it without touching Cato's direct deps.

### One-line fix command (if/when we choose to apply it)

```bash
cd <path-to-cato-ficc-mcp> && npm audit fix
```

This bumps hono to ≥4.12.14. No code changes to `index.js` required.
The change is reversible via `git checkout package-lock.json` since
Cato pins its direct deps with caret ranges in `package.json`.

---

## General threat model (for future additions)

Cato's attack surface is narrower than a typical Node service because:

- **No inbound network surface.** Stdio transport means no listening
  sockets. SSRF, CSRF, request-smuggling, auth-bypass classes do
  not apply.
- **No persistent state.** One in-memory sticky price cache; no
  database, no file writes, no credentials on disk.
- **No authentication logic.** The MCP client (Claude Desktop / Claude
  Code) is trusted by construction; there is no user-auth code path
  for an attacker to target.
- **Outbound HTTP is GET-only against a fixed URL allowlist.** No
  dynamic URL construction from untrusted input. Response bodies are
  parsed as JSON via axios defaults and returned to the MCP client
  verbatim (no templating, no shell invocation).

**Classes that DO apply and warrant attention on any future change:**

- **Upstream data poisoning.** If one of the allowlisted APIs is
  compromised (NY Fed, FRED, etc.), Cato will faithfully relay bad
  numbers to Verana L0. No code-level fix; mitigation is diversity
  of sources for the same datum (cross-check SOFR from NY Fed vs
  FRED, for example).
- **Prototype pollution via axios response bodies.** Low probability
  (axios parses JSON via `JSON.parse` which is prototype-safe); worth
  re-checking if Cato ever hand-rolls response parsing.
- **Schema-skirting MCP arguments.** An LLM client could pass
  unexpected types through the MCP `arguments` field. Cato's tools
  coerce inputs (`parseFloat`, default values) but do not exhaustively
  validate. Not currently a security issue because there is no
  privileged sink; becomes one if any tool ever shells out or writes
  to disk.

---

*Produced by AI coding agent (internal codename "Sam"); reviewed, validated,
and owned by G. Ravelo, Ravelo Strategic Solutions LLC. No modifications to
Cato's code are made by this document.*

---

## v0.3.0 change review — XRPL rail (2026-07-23)

Delta review for the xrpl settlement rail. Scope: new outbound surface
and threat-model impact only; the hono disposition above is unchanged
(no new npm dependencies were added — XRPL calls reuse axios).

### New outbound endpoints

| Endpoint | Operator | Method | Body |
|---|---|---|---|
| `https://xrplcluster.com/` | Community-run XRPL cluster | JSON-RPC POST | static `{"method":"fee","params":[{}]}` |
| `https://s1.ripple.com:51234/` | Ripple (fallback) | JSON-RPC POST | static `{"method":"fee","params":[{}]}` |

Additionally, `https://api.coingecko.com` requests now include `ripple`
in the `ids` parameter (same endpoint, same GET pattern as before).

No untrusted input flows into any XRPL request URL or body — both are
fixed constants, consistent with the existing allowlist posture.

### Correction to the 2026-04-19 audit's outbound-surface claim

Sam's reachability analysis states outbound HTTP is "GET-only against a
fixed URL allowlist." That was already superseded when the Solana
JSON-RPC POST landed (v0.2.0+) and is further superseded by the XRPL
POSTs above. The accurate statement as of v0.3.0: **outbound HTTP is a
fixed allowlist of GET endpoints plus three JSON-RPC POST endpoints
(Solana RPC, xrplcluster.com, s1.ripple.com) whose request bodies are
static constants.** The security properties the audit relied on
(no dynamic URL construction, no untrusted input in requests, responses
parsed as JSON and relayed verbatim) continue to hold.

### Threat-model impact

- **Upstream data poisoning (existing class, new instance).**
  xrplcluster.com is community-operated, not Ripple-operated. A
  compromised or lying cluster could misreport `open_ledger_fee`,
  skewing the fee input to the routing recommendation. Mitigations:
  s1.ripple.com fallback is Ripple-operated; the value is bounded in
  impact (worst case is a wrong advisory `recommended_rail`, which
  remains an input to the human authority gate, never an execution
  path); and an absurd fee simply prices XRPL out of the ultra-low
  tier rather than forcing selection.
- **Fail-safe behavior.** If all XRPL endpoints are unreachable, the
  rail degrades to the reference base fee (10 drops) with an `error`
  field and `status: "placeholder"` — mirroring the Solana fail-safe
  pattern; no new failure mode.

---

## Regulatory and citation facts (doctrine version 0.3.0)

Authoritative facts governing all descriptions, comments, and notes in this
repo. These supersede any prior wording.

### GENIUS Act

Enacted July 2025. Governs **privately issued payment stablecoins** only.
Does not create, authorize, or enable tokenized Federal Reserve reserves or
central-bank digital currency. References to "GENIUS Act pending" or "GENIUS
Act moving through the pipeline" are factually incorrect as of this version.

### Tokenized Fed reserves / PORTS / fed_l1

Tokenized Federal Reserve reserves **do not exist and remain hypothetical**.
The `fed_l1` slot in Cato is a non-functional placeholder documented for
architectural completeness. No tool routes to or through it.

### PORTS citation

Duffie, D. & Wilson, D. R. (2025). *The case for a new floating rate Treasury
note.* Brookings Institution (Dec 2025). Proposes Perpetual Overnight Rate
Treasury Securities (PORTS). **Wilson is a co-author; the paper title is not
"The Case for PORTS."** Citations that omit Wilson or use the short title are
incorrect.

### SEC no-action letter (Dec 2025)

The SEC's December 2025 no-action relief permits DTC to pilot tokenized
securities settlements. Tokens are assigned **no settlement or collateral
value**; on-chain settlement finality is not established by this letter.

### JEP "Safe Haven" paper

Duffie, D. (2025). *How US Treasuries Can Remain the World's Safe Haven.*
Journal of Economic Perspectives. This is **dealer-balance-sheet and safe-haven
demand research**, not a tokenization proposal. Should not be cited as a basis
for on-chain settlement claims.

### XRPL rail facts (v0.3.0)

An XRPL transaction included in a validated ledger is **final** —
consensus validation is deterministic, with no probabilistic
confirmation window. Ledgers close every ~3-5 seconds. Fees are
denominated in drops (1 XRP = 1,000,000 drops); the reference base fee
is 10 drops and the open-ledger fee escalates under load. Incident
record: one 64-minute consensus stall on Feb 4-5, 2025, with no loss
of user assets — descriptions of XRPL as outage-free are incorrect and
the stall must remain disclosed in `xrpl_note`. The deterministic-
finality preference over Solana at equal ultra-low cost is doctrine
(gate_core.js v0.3.0) and must stay mirrored in the Python twin per
PARITY_XRPL.md.

### Read-only scope

Cato is read-only and advisory. No tool in this server initiates, routes, or
settles a trade. The doctrine gate outputs (`PROCEED` / `HOLD` / `ESCALATE`)
and `recommended_chain` / `recommended_rail` fields are advisory inputs to a
human authority gate, not execution paths.

### Version table

| Component | Version |
|---|---|
| Package (`cato-ficc-mcp`) | 0.3.0 |
| Doctrine (xrpl deterministic-finality preference) | 0.3.0 |
| Doctrine (SOFR delta trigger restored) | 0.2.2 |
