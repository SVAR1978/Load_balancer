# Consistent Hash Load Balancer

A production-grade, in-memory load balancer built with **Node.js & Express** that replaces naive random routing with **Consistent Hashing** — ensuring the same IP always reaches the same node, even when nodes are added or removed.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Features

| Feature | Description |
|---|---|
| **Consistent Hashing** | SHA-256 hash ring with virtual nodes — same IP always maps to the same server |
| **Weighted Routing** | Assign higher weights to prioritize powerful nodes |
| **Health Checks** | Automatic failover when a node goes down |
| **Rate Limiting** | Per-IP fixed-window throttling |
| **Metrics Dashboard** | Real-time web UI with live charts & request log |
| **REST API** | Full CRUD for nodes, routing, simulation |
| **CLI Simulator** | Comprehensive demo of all features |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 16

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the API server + dashboard
npm start
# → Server: http://localhost:3000
# → Dashboard: http://localhost:3000

# 3. Or run the CLI simulation
npm run simulate
```

### Development Mode (auto-restart)
```bash
npm run dev
```

Video Demonstration:-


https://github.com/user-attachments/assets/e44fdd8e-92dc-48d2-ba70-e261e8d994f5





---

## 🏗️ Architecture

```
src/
├── core/
│   ├── consistentHash.js   # Hash ring with virtual nodes
│   ├── healthCheck.js       # Node health monitor
│   ├── loadBalancer.js      # Main LB engine (ties everything together)
│   ├── metrics.js           # In-memory metrics collector
│   └── rateLimiter.js       # Per-IP rate limiter
├── utils/
│   ├── hash.js              # SHA-256 deterministic hash
│   └── logger.js            # Colour-coded structured logger
├── public/
│   └── index.html           # Metrics dashboard (single-page)
├── server.js                # Express API server
├── simulate.js              # CLI simulation runner
└── test.js                  # Verification tests
```

### How Consistent Hashing Works

```
        0 ──────────── 2^32
        │    ◆ Node-A   │
        │  ◆ Node-C     │
        │       ◆ Node-B│
        │    ★ IP hash  │
        └───────────────┘
        
  1. Nodes are placed on a ring at multiple positions (virtual nodes)
  2. An IP is hashed → find the next node clockwise on the ring
  3. Same IP = same hash = same node (deterministic!)
  4. Add/remove a node → only ~1/N keys are remapped
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/route` | Route a specific IP `{ "ip": "1.2.3.4" }` |
| `GET` | `/api/route/random` | Route with auto-generated random IP |
| `GET` | `/api/status` | Full system status (nodes, health, metrics) |
| `GET` | `/api/metrics` | Metrics snapshot |
| `GET` | `/api/health` | Node health status |
| `POST` | `/api/nodes` | Add a node `{ "name": "Node-D", "weight": 2 }` |
| `DELETE` | `/api/nodes/:name` | Remove a node |
| `PUT` | `/api/nodes/:name/weight` | Update weight `{ "weight": 3 }` |
| `PUT` | `/api/nodes/:name/down` | Mark node as DOWN |
| `PUT` | `/api/nodes/:name/up` | Mark node as UP |
| `POST` | `/api/simulate` | Simulate N requests `{ "count": 50 }` |

### Example: cURL

```bash
# Route a specific IP
curl -X POST http://localhost:3000/api/route \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.42"}'

# Route random IP
curl http://localhost:3000/api/route/random

# Add weighted node
curl -X POST http://localhost:3000/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"name": "Node-D", "weight": 3}'

# Mark node down
curl -X PUT http://localhost:3000/api/nodes/Node-A/down

# Simulate 100 requests
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"count": 100}'
```

---

## 🧪 Run Tests

```bash
npm test
```

Verifies: determinism, fair distribution, minimal remapping on topology change, weighted routing, and rate limiting.

---

## 🖥️ CLI Simulation

```bash
npm run simulate
```

Runs a comprehensive demo showcasing:
1. Basic routing with 3 nodes
2. **Determinism proof** — same IP → same node every time
3. Node addition with minimal remapping
4. Weighted routing (3× priority)
5. Health-check failover
6. Rate limiting in action
7. Final metrics summary with distribution bars

---

## 📊 Metrics Dashboard

Open `http://localhost:3000` after starting the server to see:

- **KPI Cards** — total requests, RPS, rate-limited, fallbacks
- **Node Distribution** — visual bar chart of per-node traffic
- **Health Controls** — mark nodes up/down with one click
- **Request Log** — live table of recent routed requests
- **Simulation Buttons** — fire 10/50/200 requests instantly

---

## 🔧 Configuration

Edit the node setup in `src/server.js`:

```javascript
const lb = new LoadBalancer({
  nodes: [
    { name: "Node-A", weight: 1 },
    { name: "Node-B", weight: 2 },  // 2× traffic
    { name: "Node-C", weight: 1 },
  ],
  rateLimit: 100,       // max requests per IP per window
  rateWindow: 60_000,   // 60-second window
  healthInterval: 15_000 // health check every 15s
});
```

---

## 📝 License

MIT
