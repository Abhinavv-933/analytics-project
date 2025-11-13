# 🚀 Web Analytics Backend (Ingestion + Queue + Processor + Reporting)

A high-performance **event analytics backend** built using:

- **Node.js**
- **Redis Queue**
- **MongoDB**
- **Docker Compose**
- **Microservice Architecture**

This project simulates how real analytics platforms (like Mixpanel, Segment, PostHog) collect and process high-volume events **without slowing down clients**.

---

# ⭐ Features

### 🟢 1. Ultra-fast Ingestion API
- Accepts events in **milliseconds**
- Does **NOT** block on DB writes
- Pushes events into Redis queue asynchronously

### 🟡 2. Background Processor Worker
- Consumes events from Redis  
- Inserts raw events into MongoDB  
- Updates aggregated statistics  
- Tracks unique users  

### 🔵 3. Reporting / Stats API
Returns aggregated analytics such as:

- total views  
- unique users  
- top paths  

---

# 🧠 High-Level Architecture

yaml
Copy code
        ┌─────────────────────┐
        │   Client Website     │
        │  (Sends Events)      │
        └──────────┬───────────┘
                   |
                   v
        ┌─────────────────────┐
        │   Ingestion API      │
        │ (Fast, Non-Blocking) │
        └──────────┬───────────┘
                   |
          Redis Queue (events_queue)
                   |
                   v
        ┌─────────────────────┐
        │   Processor Worker   │
        │  (Async Consumer)    │
        └──────────┬───────────┘
                   |
                   v
        ┌─────────────────────┐
        │       MongoDB        │
        │ events / stats/users │
        └──────────┬───────────┘
                   |
                   v
        ┌─────────────────────┐
        │    Reporting API     │
        │ Returns Aggregations │
        └─────────────────────┘
yaml
Copy code

---

# ⚙️ Tech Stack

| Component       | Technology |
|----------------|------------|
| APIs           | Node.js, Express |
| Queue          | Redis |
| Worker         | Node.js |
| Database       | MongoDB |
| Containerization | Docker Compose |

---

# 📁 Folder Structure

analytics-project/
│── docker-compose.yml
│── README.md
│
└── services/
├── ingestion/
│ ├── src/index.js
│ ├── package.json
│ └── Dockerfile
│
├── processor/
│ ├── src/worker.js
│ ├── package.json
│ └── Dockerfile
│
└── reporting/
├── src/index.js
├── package.json
└── Dockerfile

yaml
Copy code

---

# 🐳 Setup & Run Instructions (Docker Only)

## 1️⃣ Clone the repo

```bash
git clone https://github.com/Abhinavv-933/analytics-project.git
cd analytics-project
2️⃣ Run all services
bash
Copy code
docker compose up --build
This will start:

Redis

MongoDB

Ingestion API → http://localhost:3001

Reporting API → http://localhost:3002

Processor Worker

📡 API Documentation
✅ POST /event (Ingestion API)
URL:

bash
Copy code
http://localhost:3001/event
Method:
POST

Request Body:

json
Copy code
{
  "site_id": "site-abc-123",
  "event_type": "page_view",
  "path": "/pricing",
  "user_id": "user-xyz-789",
  "timestamp": "2025-11-12T19:30:01Z"
}
Success Response:

json
Copy code
{
  "status": "accepted",
  "event_id": "uuid-value"
}
📊 GET /stats (Reporting API)
URL:

bash
Copy code
http://localhost:3002/stats?site_id=site-abc-123&date=2025-11-12
Response Example:

json
Copy code
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
🗄️ Database Schema
🔹 Raw Events (events)
json
Copy code
{
  "event_id": "uuid",
  "site_id": "site-abc-123",
  "event_type": "page_view",
  "path": "/pricing",
  "user_id": "user-xyz-789",
  "timestamp": "2025-11-12T19:30:01Z",
  "date": "2025-11-12"
}
🔹 Aggregated Stats (stats)
json
Copy code
{
  "site_id": "site-abc-123",
  "date": "2025-11-12",
  "total_views": 1450,
  "paths": {
    "/pricing": 700,
    "/": 250
  }
}
🔹 Unique Users (unique_users)
json
Copy code
{
  "site_id": "site-abc-123",
  "date": "2025-11-12",
  "user_id": "user-xyz-789",
  "first_seen": "2025-11-12T19:30:01Z"
}
🔥 Why This Architecture?
🟩 Fast Ingestion
Clients should not wait for database writes.

🟦 Redis Queue
Makes ingestion asynchronous and highly scalable.

🟧 Background Worker
Handles heavy tasks:

DB writes

Unique user tracking

Aggregation calculations

🟨 MongoDB
Stores both raw events and optimized aggregated stats.

🚀 Scaling Strategy (Interview-Ready)
Layer	Scaling Method
Ingestion API	Load balancer + multiple replicas
Queue	Move from Redis → Kafka
Processor	Add more worker instances
Database	Sharding or migrate to ClickHouse
Reporting API	Add read replicas

👨‍💻 Author
Abhinav
Stack: Node.js, Redis, MongoDB, Docker