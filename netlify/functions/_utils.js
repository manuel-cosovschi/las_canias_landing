const assertAuth = (event) => {
  const incoming =
    event.headers["x-lc-secret"] ||
    event.headers["X-Lc-Secret"] ||
    event.headers["X-LC-SECRET"] ||
    "";

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

const callN8n = async (path, { method = "POST", body = null, baseUrl, secret }) => {
  const url = `${baseUrl}${path}`;

  const headers = {
    "x-lc-secret": secret,
  };

  // Solo mandamos JSON si hay body (y no en GET)
  const hasBody = body != null && method !== "GET";
  if (hasBody) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message || data?.error || "Error llamando a n8n";
    throw new Error(msg);
  }

  return data;
};

module.exports = { assertAuth, json, callN8n };