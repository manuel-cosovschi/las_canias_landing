import { getStore } from "@netlify/blobs";

const STORE_NAME = "booking-config";
const KEY = "window";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

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
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    const raw = Array.isArray(body.enabledMonths) ? body.enabledMonths : null;
    if (!raw) return json(400, { message: "enabledMonths debe ser un array" });

    const enabledMonths = Array.from(
      new Set(raw.filter((m) => typeof m === "string" && MONTH_RE.test(m)))
    ).sort();

    const store = getStore(STORE_NAME);
    await store.setJSON(KEY, { enabledMonths, updatedAt: new Date().toISOString() });

    return json(200, { ok: true, enabledMonths });
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};
