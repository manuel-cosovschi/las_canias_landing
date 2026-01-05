const assertAuth = (event) => {
  const incoming =
    event.headers["x-lc-secret"] ||
    event.headers["X-Lc-Secret"] ||
    event.headers["x-lc-secret".toLowerCase()];

  const expected = process.env.LC_OWNER_SECRET;

  if (!expected) return false;
  if (!incoming) return false;

  return incoming === expected;
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

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-lc-secret": secret,
    },
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message || data?.error || "Error llamando a n8n";
    throw new Error(msg);
  }

  return data;
};

module.exports = { assertAuth, json, callN8n };