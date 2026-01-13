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

function parseBasicAuth(header) {
  if (!header) return null;
  const [type, value] = header.split(" ");
  if (type !== "Basic" || !value) return null;
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

const assertAdmin = (event) => {
  // 1) Basic auth (admin.html)
  const creds = parseBasicAuth(event.headers.authorization || event.headers.Authorization);
  if (creds) {
    const u = process.env.ADMIN_USER;
    const p = process.env.ADMIN_PASS;
    if (u && p && creds.user === u && creds.pass === p) return true;
  }

  // 2) fallback: x-lc-secret (por si lo usás con curl)
  const incoming =
    event.headers["x-lc-secret"] ||
    event.headers["X-Lc-Secret"] ||
    event.headers["X-LC-SECRET"] ||
    "";

  const expected = process.env.LC_OWNER_SECRET;
  if (expected && incoming === expected) return true;

  return false;
};

module.exports = { assertAuth, assertAdmin, json, callN8n };