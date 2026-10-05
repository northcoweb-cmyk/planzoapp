const { checkUrl } = require('../lib/check');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const origin = req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : '');
    res.status(200).json(await checkUrl(req.query.url, { origin }));
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e.message || e) });
  }
};
