# Security policy

## Reporting a vulnerability

Please report security problems **privately**. Do not open a public issue, pull request or discussion for a suspected vulnerability — a public report discloses the problem before it can be fixed.

To report privately:

1. Go to this repository's **Security** tab on GitHub.
2. Choose **Report a vulnerability**. This opens a private advisory that only you and the maintainer, Bill Ravelo, can see.

Include what you found, how to reproduce it, and what you believe the impact is. You will get an acknowledgement, and the fix and any disclosure will be coordinated with you in that private advisory.

## Scope

Cato-FICC-MCP is a research Model Context Protocol server. It is started by the client
over stdio, serves no HTTP, moves no value and submits nothing to any rail. It reads
public reference data and may call third-party APIs on keys the operator supplies.

Reports are welcome, and in particular: anything that would let a tool return a gate
decision not derived from its stated inputs, anything that would let a missing or failed
reading resolve to PROCEED rather than a hold, and anything that would leak an API key
into a response or a log line.

## Supported versions

Only the latest commit on `main` is supported.
