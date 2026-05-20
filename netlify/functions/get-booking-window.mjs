import { getStore } from "@netlify/blobs";

const STORE_NAME = "booking-config";
const KEY = "window";

const DEFAULT_ENABLED_MONTHS = [
  "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
];

const assertAuth = (event) => {
  const h = event.headers || {};
  const incoming = h["x-lc-secret"] || h["X-Lc-Secret"] || h["X-LC-SECRET"] || "";
  const expected = process.env.LC_OWNER_SECRET || "";
  return !!expected && incoming === expected;
};

const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-lc-secret",
  },
  body: JSON.stringify(payload),
});

export const handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });

  try {
    let enabledMonths = DEFAULT_ENABLED_MONTHS;
    try {
      const store = getStore(STORE_NAME);
      const saved = await store.get(KEY, { type: "json" });
      if (saved && Array.isArray(saved.enabledMonths)) {
        enabledMonths = saved.enabledMonths;
      }
    } catch (_) {}

    return json(200, { ok: true, enabledMonths });
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};
