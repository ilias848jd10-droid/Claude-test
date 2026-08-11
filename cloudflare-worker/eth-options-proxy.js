// Minimal CORS-adding proxy for Binance's ETH options API (eapi.binance.com),
// which doesn't send Access-Control-Allow-Origin and so blocks browser fetch()
// calls directly. Deploy as a Cloudflare Worker (free tier).
//
// Locked down on purpose: only forwards GET requests to the two specific
// Binance options endpoints this app needs, and only allows the app's own
// origin — this is not a general-purpose open proxy.

const ALLOWED_ORIGIN = "https://ilias848jd10-droid.github.io";
const BINANCE_EAPI = "https://eapi.binance.com";
const ALLOWED_PATHS = new Set(["/eapi/v1/exchangeInfo", "/eapi/v1/klines"]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "GET" || !ALLOWED_PATHS.has(url.pathname)) {
      return new Response("Not found", { status: 404, headers: corsHeaders() });
    }

    const target = `${BINANCE_EAPI}${url.pathname}${url.search}`;
    const upstream = await fetch(target, { method: "GET" });
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  },
};
