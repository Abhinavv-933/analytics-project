const express = require('express');
const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/analytics';
const PORT = process.env.PORT || 3002;

function isoDateFromQuery(q) {
  if (!q) {
    return new Date().toISOString().slice(0, 10);
  }
  const d = new Date(q);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function main() {
  const app = express();
  const mongoClient = new MongoClient(MONGO_URL);
  await mongoClient.connect();
  const db = mongoClient.db();
  const statsCol = db.collection('stats');
  const uniqueUsersCol = db.collection('unique_users');

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // GET /stats?site_id=site-abc-123&date=2025-11-12
  app.get('/stats', async (req, res) => {
    const { site_id } = req.query;
    const dateQuery = req.query.date;
    if (!site_id) return res.status(400).json({ error: 'site_id required' });

    const date = isoDateFromQuery(dateQuery);
    if (!date) return res.status(400).json({ error: 'invalid date' });

    try {
      // Fetch aggregate doc
      const statDoc = await statsCol.findOne({ site_id, date }) || { total_views: 0, paths: {} };

      // Count unique users
      const uniqueUsersCount = await uniqueUsersCol.countDocuments({ site_id, date });

      // Build top_paths array from statDoc.paths object
      const pathsObj = statDoc.paths || {};
      const top_paths = Object.entries(pathsObj)
        .map(([path, views]) => ({ path, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10); // top 10

      return res.json({
        site_id,
        date,
        total_views: statDoc.total_views || 0,
        unique_users: uniqueUsersCount,
        top_paths
      });
    } catch (err) {
      console.error('Reporting error', err);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  app.listen(PORT, () => {
    console.log(`Reporting service listening on port ${PORT}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
