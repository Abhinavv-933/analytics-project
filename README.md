# Analytics Project (Ingestion + Processor + Reporting)

## Overview
This project implements a minimal high-throughput analytics backend with three components:
- **Ingestion API** (`POST /event`) — validates events and pushes them to a Redis queue (fast, returns 202 immediately).
- **Processor** (background worker) — pulls events from Redis, stores raw events to MongoDB, updates aggregated stats and unique-users.
- **Reporting API** (`GET /stats`) — reads aggregated stats and returns summaries.

Stack: Node.js, Redis, MongoDB (all runnable via Docker Compose).

---

## Architecture decision & async queue
- I use **Redis** as a queue (RPUSH/BRPOP). Reason: very quick to stand up, low-latency, reliable for demo/prototype; in production you could swap to Kafka/Pulsar/Kinesis.
- The ingestion endpoint **only enqueues** the event and immediately returns `202 Accepted` to keep client latency extremely low.
- The **processor** asynchronously reads queue items and updates DB, enabling the ingestion API to be super-fast and non-blocking.

---

## Database schema
### Collections:
1. `events` (raw events)
   - `event_id`, `site_id`, `event_type`, `path`, `user_id`, `timestamp`, `date`
2. `stats` (aggregated per site & date)
   - document keyed by `{ site_id, date }`
   - fields: `total_views` (number), `paths` (object mapping path -> count)
   - example:
     {
       "site_id": "site-abc-123",
       "date": "2025-11-12",
       "total_views": 1450,
       "paths": { "/pricing": 700, "/blog/post-1": 500, "/": 250 }
     }
3. `unique_users`
   - per unique user per site+date
   - document: `{ site_id, date, user_id, first_seen }`
   - unique index on `(site_id, date, user_id)` to ensure uniqueness easily

---

## Setup (local / demo)
Requirements: Docker & Docker Compose.

1. Clone repo or extract ZIP into `analytics-project/`
2. From project root:
   ```bash
   docker compose up --build
   ```
3. This will start:
   - MongoDB on `localhost:27017`
   - Redis on `localhost:6379`
   - Ingestion API on `http://localhost:3001`
   - Reporting API on `http://localhost:3002`
   - Processor runs as a background container (no external port)

---

## API Usage

### Ingest event
**Endpoint**
```
POST http://localhost:3001/event
Content-Type: application/json
Body:
{
  "site_id": "site-abc-123",
  "event_type": "page_view",
  "path": "/pricing",
  "user_id": "user-xyz-789",
  "timestamp": "2025-11-12T19:30:01Z"
}
```

**curl**
```bash
curl -X POST http://localhost:3001/event \
  -H "Content-Type: application/json" \
  -d '{"site_id":"site-abc-123","event_type":"page_view","path":"/pricing","user_id":"user-xyz-789","timestamp":"2025-11-12T19:30:01Z"}'
```

Returns quickly:
```json
{ "status": "accepted", "event_id": "..." }
```

### Get stats
**Endpoint**
```
GET http://localhost:3002/stats?site_id=site-abc-123&date=2025-11-12
```
If `date` omitted, service returns stats for today's date (server date). Date format: `YYYY-MM-DD`.

**curl**
```bash
curl "http://localhost:3002/stats?site_id=site-abc-123&date=2025-11-12"
```

**Example response**
```json
{
  "site_id": "site-abc-123",
  "date": "2025-11-12",
  "total_views": 1450,
  "unique_users": 212,
  "top_paths": [
    { "path": "/pricing", "views": 700 },
    { "path": "/blog/post-1", "views": 500 },
    { "path": "/", "views": 250 }
  ]
}
```

---

## Notes & Trade-offs
- **Fast ingestion**: the ingestion service waits only for Redis push; the client does not wait for DB writes.
- **Unique users**: implemented via `unique_users` collection with unique compound index; this is accurate but may produce many small documents if you have millions of unique visitors — for production, use HyperLogLog, Redis sets, or other cardinality estimation.
- **Top paths**: stored as a nested object in `stats` (`paths` field). For many unique paths, this can grow large; production systems shard or pre-aggregate on the fly / use OLAP stores (ClickHouse).
- **Durability**: Redis + Mongo provide reasonable durability for a demo. In prod, consider Kafka + ClickHouse/BigQuery for high-scale analytics.

---

## Testing tips
- Send a burst of events (use `for` loop or `k6`) to validate ingestion latency and processor throughput.
- Inspect Mongo collections to confirm aggregated values:
  - `mongo` shell: `use analytics; db.stats.find().pretty(); db.unique_users.countDocuments({site_id:"site-abc-123", date:"2025-11-12"});`

---

## Deliverables
- Source code (this repository)
- README (this file)
- Docker Compose orchestration for local testing

---
