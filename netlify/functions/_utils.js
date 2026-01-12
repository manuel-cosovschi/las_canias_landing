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

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-lc-secret": secret,
      },
      body: body ? JSON.stringify(body) : null,
    });
  } catch (e) {
    // Esto es lo que HOY te está pasando: TypeError: fetch failed
    // Node suele traer la causa real en e.cause (ENOTFOUND/ECONNRESET/ETIMEDOUT/etc.)
    const cause = e?.cause ? {
      code: e.cause.code,
      errno: e.cause.errno,
      syscall: e.cause.syscall,
      address: e.cause.address,
      port: e.cause.port,
    } : null;

    throw new Error(
      JSON.stringify({
        message: e.message || "fetch failed",
        url,
        cause,
      })
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message || data?.error || "Error llamando a n8n";
    throw new Error(JSON.stringify({ message: msg, url, status: res.status, data }));
  }

  return data;
};

module.exports = { assertAuth, json, callN8n };