const { createClient } = require('redis');
const { MongoClient } = require('mongodb');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/analytics';
const QUEUE_NAME = 'events_queue';

async function isoDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function main() {
  // Redis
  const redis = createClient({ url: REDIS_URL });
  redis.on('error', (e) => console.error('Redis error', e));
  await redis.connect();

  // Mongo
  const mongoClient = new MongoClient(MONGO_URL);
  await mongoClient.connect();
  const db = mongoClient.db(); // analytics
  const eventsCol = db.collection('events');
  const statsCol = db.collection('stats');
  const uniqueUsersCol = db.collection('unique_users');

  // Create indexes
  await eventsCol.createIndex({ site_id: 1, timestamp: 1 });
  await uniqueUsersCol.createIndex({ site_id: 1, date: 1, user_id: 1 }, { unique: true, background: true });

  console.log('Processor connected to Redis and MongoDB. Waiting for events...');

  while (true) {
    try {
      // BRPOP blocks until an element is available; returns [queue, item]
      const res = await redis.brPop(QUEUE_NAME, 0);
      if (!res) continue;
      const payload = res.element || res[1] || null;
      if (!payload) continue;

      const event = JSON.parse(payload);
      // Basic validation/correction
      const date = await isoDate(event.timestamp || new Date().toISOString());
      const pathKey = (event.path || '/').toString();

      // 1) Write raw event to events collection
      await eventsCol.insertOne({
        event_id: event.id,
        site_id: event.site_id,
        event_type: event.event_type,
        path: event.path || '/',
        user_id: event.user_id || null,
        timestamp: event.timestamp,
        date
      });

      // 2) Update stats (increment total_views and path count)
      const statFilter = { site_id: event.site_id, date };
      const statUpdate = {
        $inc: { total_views: 1, [`paths.${pathKey}`]: 1 }
      };
      await statsCol.updateOne(statFilter, statUpdate, { upsert: true });

      // 3) Record unique user if user_id present
      if (event.user_id) {
        try {
          await uniqueUsersCol.updateOne(
            { site_id: event.site_id, date, user_id: event.user_id },
            { $setOnInsert: { site_id: event.site_id, date, user_id: event.user_id, first_seen: new Date().toISOString() } },
            { upsert: true }
          );
        } catch (err) {
          // ignore duplicate key errors or other transient
          if (err.code !== 11000) console.error('unique user upsert error', err);
        }
      }
    } catch (err) {
      console.error('Processor loop error', err);
      // brief sleep before retrying on unexpected error to avoid tight crash loops
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
