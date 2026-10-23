#!/usr/bin/env node
"use strict";

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failClosed = process.argv.includes("--fail-closed");
const env = { ...process.env };
if (failClosed) {
  env.HTTPS_PROXY = "http://127.0.0.1:9";
  env.HTTP_PROXY = "http://127.0.0.1:9";
  env.NO_PROXY = "";
}

async function main() {
  const client = new Client({ name: "cato-d2-evidence", version: "1.0.0" });
  const transport = new StdioClientTransport({ command: process.execPath, args: ["index.js"], cwd: root, env, stderr: "pipe" });
  await client.connect(transport);
  try {
    const catalog = await client.listTools();
    if (failClosed) {
      const response = await client.callTool({ name: "lookup_lei", arguments: { lei: "HWUPKR0MPOU8FGXBT394" } });
      const body = JSON.parse(response.content[0].text);
      console.log(JSON.stringify({ mode: "fail-closed", tool_count: catalog.tools.length, unavailable: body.unavailable === true, static_fallback: !body.error }));
      if (body.unavailable !== true || !body.error) process.exitCode = 1;
      return;
    }

    const calls = [
      ["get_sofr", { days: 2 }],
      ["get_treasury_yield_curve", { days: 2 }],
      ["get_sec_fails_to_deliver", { cusip: "037833100", period_url: "https://www.sec.gov/files/data/fails-deliver-data/cnsfails202609b.zip" }],
      ["get_ofr_financial_stress_index", { days: 2 }],
      ["lookup_lei", { lei: "HWUPKR0MPOU8FGXBT394" }],
      ["map_cusip_to_figi", { cusip: "037833100" }],
      ["screen_ofac_sdn", { name: "BANCO NACIONAL DE CUBA" }],
      ["get_treasury_average_interest_rates", { limit: 2 }],
    ];
    const evidence = [];
    for (const [name, args] of calls) {
      const response = await client.callTool({ name, arguments: args });
      const body = JSON.parse(response.content[0].text);
      evidence.push({ tool: name, live: !body.error && body.unavailable !== true, source: body.source || null, observations: body.observations?.length ?? body.mappings?.length ?? body.matches?.length ?? null, error: body.error || null });
    }
    console.log(JSON.stringify({ mode: "live", date: new Date().toISOString(), tool_count: catalog.tools.length, evidence }, null, 2));
    if (evidence.some((item) => !item.live)) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
