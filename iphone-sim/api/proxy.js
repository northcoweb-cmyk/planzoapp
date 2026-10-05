const { proxy } = require('../lib/proxy');
// vercel.json rewrites every non-simulator path here with the original path in ?__p=
module.exports = async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.searchParams.get('__p') || '/';
  u.searchParams.delete('__p');
  try { await proxy(req, res, { path: p + u.search }); }
  catch (e) { if (!res.headersSent) { res.statusCode = 500; res.end('Proxy error: ' + e.message); } }
};
module.exports.config = { api: { bodyParser: false } };
