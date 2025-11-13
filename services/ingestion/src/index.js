const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PORT = process.env.PORT || 3001;
const QUEUE_NAME = 'events_queue';

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '200kb' }));

  const redis = createClient({ url: REDIS_URL });
  redis.on('error', (err) => console.error('Redis client error', err));
  await redis.connect();

  // Basic health
  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.post('/event', async (req, res) => {
    try {
      const { site_id, event_type, path, user_id, timestamp } = req.body || {};
      if (!site_id || !event_type) {
        return res.status(400).json({ error: 'site_id and event_type are required' });
      }

      // Use client-provided timestamp if valid, else set server time
      const ts = timestamp ? new Date(timestamp) : new Date();
      if (isNaN(ts.getTime())) {
        return res.status(400).json({ error: 'timestamp must be ISO format' });
      }

      const event = {
        id: uuidv4(),
        site_id,
        event_type,
        path: path || null,
        user_id: user_id || null,
        timestamp: ts.toISOString()
      };

      // push to queue (RPUSH so worker can BRPOP to get items FIFO)
      // We don't await long processing; we want to be fast. We still await Redis command to ensure it's enqueued.
      await redis.rPush(QUEUE_NAME, JSON.stringify(event));

      // Immediately respond
      return res.status(202).json({ status: 'accepted', event_id: event.id });
    } catch (err) {
      console.error('Ingest error', err);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  app.listen(PORT, () => {
    console.log(`Ingestion service running on port ${PORT}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
