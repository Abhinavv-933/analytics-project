# Web Analytics Backend

A high-performance, event-driven analytics pipeline built to handle high-volume tracking without slowing down client applications — inspired by how platforms like Mixpanel, Segment, and PostHog work under the hood.

**Stack:** Node.js · Redis · MongoDB · Docker Compose

---

## How It Works

Events from client websites are accepted instantly by the Ingestion API and dropped into a Redis queue — no waiting on database writes. A background Processor Worker drains the queue asynchronously, writing raw events to MongoDB and updating aggregated stats. The Reporting API then serves those aggregations on demand.

```
Client Website
      │
      ▼
Ingestion API        ← Fast, non-blocking. Returns in milliseconds.
      │
      ▼
Redis Queue          ← Decouples ingestion from processing.
      │
      ▼
Processor Worker     ← Async consumer: writes events, updates stats, tracks users.
      │
      ▼
MongoDB              ← Stores raw events, aggregated stats, and unique users.
      │
      ▼
Reporting API        ← Serves analytics queries.
```

---

## Project Structure

```
analytics-project/
├── docker-compose.yml
├── README.md
└── services/
    ├── ingestion/
    │   ├── src/index.js
    │   ├── package.json
    │   └── Dockerfile
    ├── processor/
    │   ├── src/worker.js
    │   ├── package.json
    │   └── Dockerfile
    └── reporting/
        ├── src/index.js
        ├── package.json
        └── Dockerfile
```

---

## Getting Started

**Prerequisites:** Docker and Docker Compose installed.

```bash
# Clone the repo
git clone https://github.com/Abhinavv-933/analytics-project.git
cd analytics-project

# Start all services
docker compose up --build
```

This spins up Redis, MongoDB, the Ingestion API, the Processor Worker, and the Reporting API in one command.

| Service        | URL                          |
|----------------|------------------------------|
| Ingestion API  | http://localhost:3001        |
| Reporting API  | http://localhost:3002        |

---

## API Reference

### `POST /event` — Track an Event

**URL:** `http://localhost:3001/event`

**Request body:**
```json
{
  "site_id": "site-abc-123",
  "event_type": "page_view",
  "path": "/pricing",
  "user_id": "user-xyz-789",
  "timestamp": "2025-11-12T19:30:01Z"
}
```

**Response:**
```json
{
  "status": "accepted",
  "event_id": "uuid-value"
}
```

---

### `GET /stats` — Fetch Aggregated Analytics

**URL:** `http://localhost:3002/stats?site_id=site-abc-123&date=2025-11-12`

**Response:**
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

## Database Schema

### `events` — Raw event log
```json
{
  "event_id": "uuid",
  "site_id": "site-abc-123",
  "event_type": "page_view",
  "path": "/pricing",
  "user_id": "user-xyz-789",
  "timestamp": "2025-11-12T19:30:01Z",
  "date": "2025-11-12"
}
```

### `stats` — Aggregated per site per day
```json
{
  "site_id": "site-abc-123",
  "date": "2025-11-12",
  "total_views": 1450,
  "paths": {
    "/pricing": 700,
    "/": 250
  }
}
```

### `unique_users` — Deduplication tracking
```json
{
  "site_id": "site-abc-123",
  "date": "2025-11-12",
  "user_id": "user-xyz-789",
  "first_seen": "2025-11-12T19:30:01Z"
}
```

---

## Architecture Decisions

**Why a queue between ingestion and processing?**
Clients should never wait for a database write. Pushing to Redis keeps the ingestion API at sub-millisecond response times regardless of database load.

**Why MongoDB?**
It stores both raw events (append-only) and aggregated stats (upserted per site/day) efficiently, without needing a separate OLAP store for this scale.

**Why Docker Compose?**
Brings up the full stack — Redis, MongoDB, and all three services — with a single command, making local development and demos straightforward.

---

## Scaling Path

When traffic grows beyond what this setup handles, here's the upgrade path:

| Layer          | Current          | Next Step                          |
|----------------|------------------|------------------------------------|
| Ingestion API  | Single instance  | Load balancer + horizontal replicas |
| Queue          | Redis            | Apache Kafka for durability + replay |
| Processor      | Single worker    | Multiple worker instances           |
| Database       | MongoDB          | Sharding or migrate to ClickHouse   |
| Reporting API  | Single instance  | Read replicas + caching layer       |

---

## Author

**Abhinav** · [GitHub](https://github.com/Abhinavv-933)
