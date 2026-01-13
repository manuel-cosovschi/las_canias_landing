const assertAuth = (event) => {
  const incoming =
    event.headers["x-lc-secret"] ||
    event.headers["X-Lc-Secret"] ||
    event.headers["X-LC-SECRET"];

  const expected = process.env.LC_OWNER_SECRET;
  if (!expected) return false;
  if (!incoming) return false;
  return String(incoming) === String(expected);
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

  const opts = {
    method,
    headers: {
      "x-lc-secret": secret,
    },
  };

  if (method !== "GET") {
    opts.headers["Content-Type"] = "application/json";
    opts.body = body ? JSON.stringify(body) : "{}";
  }

  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message || data?.error || "Error llamando a n8n";
    throw new Error(JSON.stringify({ message: msg, url, status: res.status, data }));
  }

  return data;
};

module.exports = { assertAuth, json, callN8n };