import { getStore } from "@netlify/blobs";

// Meses habilitados por defecto (YYYY-MM) si aún no se guardó configuración.
const DEFAULT_ENABLED_MONTHS = [
  "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
];

const STORE_NAME = "booking-config";
const KEY = "window";

export const handler = async () => {
  try {
    let enabledMonths = DEFAULT_ENABLED_MONTHS;

    try {
      const store = getStore(STORE_NAME);
      const saved = await store.get(KEY, { type: "json" });
      if (saved && Array.isArray(saved.enabledMonths)) {
        enabledMonths = saved.enabledMonths;
      }
    } catch (_) {
      // Si Blobs no está disponible, devolvemos el default.
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({ ok: true, enabledMonths }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, message: e.message || "Error" }),
    };
  }
};
