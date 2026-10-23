"use strict";
// Test-only preload: replaces axios network calls with fixtures keyed by URL so
// the stdio server can be driven end to end without network. Never loaded by
// the server in normal use.
const axios = require("axios");
const scenario = process.env.CATO_TEST_SCENARIO || "normal";

const FSI = {
  normal: "Date,OFR FSI,Credit,Equity valuation\n2026-10-21,-1.10,0.1,0.2\n2026-10-22,-1.20,0.1,0.2\n",
  elevated: "Date,OFR FSI,Credit,Equity valuation\n2026-10-22,0.80,0.1,0.2\n",
  malformed: "Day,Index\n2026-10-22,1\n",
};
const REAL_XML = `<feed><entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">2026-10-22T00:00:00</d:NEW_DATE><d:TC_5YEAR m:type="Edm.Double">1.40</d:TC_5YEAR><d:TC_7YEAR m:type="Edm.Double">1.60</d:TC_7YEAR><d:TC_10YEAR m:type="Edm.Double">1.90</d:TC_10YEAR><d:TC_20YEAR m:type="Edm.Double">2.30</d:TC_20YEAR><d:TC_30YEAR m:type="Edm.Double">2.50</d:TC_30YEAR></m:properties></content></entry></feed>`;
const NOMINAL_XML = `<feed><entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">2026-10-22T00:00:00</d:NEW_DATE><d:BC_3MONTH>3.90</d:BC_3MONTH><d:BC_2YEAR>3.50</d:BC_2YEAR><d:BC_5YEAR>3.70</d:BC_5YEAR><d:BC_10YEAR>4.10</d:BC_10YEAR><d:BC_20YEAR>4.50</d:BC_20YEAR><d:BC_30YEAR>4.60</d:BC_30YEAR></m:properties></content></entry></feed>`;
const BLS = { status: "REQUEST_SUCCEEDED", Results: { series: [{ seriesID: "X", data: [
  { year: "2026", period: "M09", periodName: "September", value: "325.0" },
  { year: "2026", period: "M08", periodName: "August", value: "324.0" },
] }] } };

axios.get = async (url, opts = {}) => {
  const params = opts.params || {};
  if (url.includes("stlouisfed")) throw new Error("FRED must not be called");
  if (url.includes("financial-stress-index")) return { data: FSI[scenario] };
  if (url.includes("interest-rates/pages/xml")) {
    return { data: params.data === "daily_treasury_real_yield_curve" ? REAL_XML : NOMINAL_XML };
  }
  if (url.includes("api.bls.gov")) return { data: BLS };
  if (url.includes("newyorkfed.org/api/rates")) {
    return { data: { refRates: [{ effectiveDate: "2026-10-22", percentRate: 4.30 }, { effectiveDate: "2026-10-21", percentRate: 4.29 }] } };
  }
  throw new Error(`offline fixture: ${url}`);
};
axios.post = async (url) => { throw new Error(`offline fixture: ${url}`); };
