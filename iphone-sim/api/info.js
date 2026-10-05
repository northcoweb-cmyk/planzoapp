// Hosted on Vercel: no real-browser engine here (serverless can't hold a live Chromium).
module.exports = (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.status(200).json({ engine: false }); };
