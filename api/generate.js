// Vercel Serverless Function: POST /api/generate
const { generate, checkAccess, HttpError } = require('../lib/gemini');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan metode POST.' });
  try {
    checkAccess(req.headers['x-access-code']);
    const result = await generate(req.body);
    return res.status(200).json(result);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return res.status(status).json({ error: status === 500 && !(e instanceof HttpError) ? 'Kesalahan server.' : e.message });
  }
};
