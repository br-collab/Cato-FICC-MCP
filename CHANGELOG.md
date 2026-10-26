# Changelog

## 0.7.0, 26 Oct 2026

- Closed the Cato/Aureon picker and gate drift across the INST-1 4,000-state
  corpus, including boolean stress and malformed rail entries.
- Added a named `MALFORMED_RAIL_ENTRY` refusal and source version constant.
- Retired the historical XRPL twin-divergence note.

## 0.6.0, 23 Oct 2026

### CLOSE-1 WP1: FRED removed (CATO-D2 Annex A v0.2 executed)

- Cato calls no FRED endpoint. The FRED client, `FRED_API_KEY` and the FRED notice are
  removed; `test/no_fred.test.js` fails if any return in source or configuration.
- The gate stress input is the OFR Financial Stress Index (decision D1, Bill, 23 Oct
  2026), read from OFR's own daily publication. Thresholds 0.5 and 1.0 are unchanged and
  labelled `PROVISIONAL_POLICY_NOT_BACKTESTED_ON_OFR_FSI` in code, README and every
  stress-reading output; recalibration is a separate order.
- TIPS real yields come from Treasury's daily real yield curve; breakevens are computed
  nominal minus real. CPI and unemployment come from the BLS public API and fail closed.
- `get_fed_balance_sheet`, `get_money_market_rates` and the ON RRP volume in `cato_sec`
  are declared not served, naming their primary publications, until a verified parser is
  admitted.
- Gate decisions for identical inputs are unchanged; parity compares decisions only.

## 0.5.0 — 23 Oct 2026

### CATO-D2 — license truth and free primary sources

- Removed CME Term SOFR and its repository-context option; the licensed benchmark is
  declared unavailable rather than redistributed.
- Moved SOFR-family gate inputs to the New York Fed and nominal Treasury curve inputs
  to Treasury's daily XML publication, while retaining live, uncached FRED access only
  for residual series with the required notice.
- Added admitted read-only lookups for SEC fails-to-deliver balances, OFR FSI, GLEIF
  LEIs, OpenFIGI mappings, OFAC SDN exact-name context, and Treasury average rates.
- Added source/license admissions, exclusions, attribution notices, and fail-closed
  behavior without changing the deterministic gate core.

## 0.4.0 — 22 Oct 2026

### CATO-D1 — repo depth and public sections

- Added read-only Office of Financial Research repo-market observations for delivery-versus-
  payment, General Collateral Finance, and tri-party series.
- Added the public section admission rule and golden-vector coverage for repo depth.
- Corrected the stress-series label so the public surface names the St. Louis Fed observation
  it actually carries.
- Preserved the advisory-only boundary: no tool authorizes, releases, routes, or submits a trade.

Versions through 0.3.2 predate this changelog; their history remains in the release tags and
pull requests.
