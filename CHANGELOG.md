# Changelog

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
