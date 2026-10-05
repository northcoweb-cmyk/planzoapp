// Visit /api/sim-debug to see what the platform passes to functions (no cookie values).
module.exports = (req, res) => {
  const h = {}; for (const k of ['host', 'x-forwarded-host', 'x-forwarded-proto', 'x-vercel-id', 'sec-fetch-dest']) h[k] = req.headers[k];
  const cookies = (req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => c.split('=')[0]);
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ url: req.url, headers: h, cookieNames: cookies, allowedHosts: process.env.ALLOWED_HOSTS || '*.vercel.app (default)' }, null, 2));
};
