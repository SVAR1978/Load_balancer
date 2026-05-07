// ============================================================
//  server.js – Express API Server
// ============================================================
//  Provides REST endpoints for the load balancer + serves the
//  real-time metrics dashboard.
//
//  Endpoints:
//  ──────────────────────────────────────────────────────────
//  POST /api/route             – Route a request (body: { ip })
//  GET  /api/route/random      – Route with random IP
//  GET  /api/status            – Full system status
//  GET  /api/metrics           – Metrics snapshot
//  GET  /api/health            – Node health status
//  POST /api/nodes             – Add a node
//  DELETE /api/nodes/:name     – Remove a node
//  PUT  /api/nodes/:name/weight – Update node weight
//  PUT  /api/nodes/:name/down  – Mark node down
//  PUT  /api/nodes/:name/up    – Mark node up
//  POST /api/simulate          – Simulate N requests
//  GET  /                      – Metrics Dashboard (HTML)
// ============================================================

const express = require("express");
const path = require("path");
const {
  LoadBalancer,
  generateRandomIP,
} = require("./core/loadBalancer");
const { logInfo } = require("./utils/logger");

const app = express();
app.use(express.json());

// ── Initialize Load Balancer ─────────────────────────────────

const lb = new LoadBalancer({
  nodes: [
    { name: "Node-A", weight: 1 },
    { name: "Node-B", weight: 1 },
    { name: "Node-C", weight: 1 },
  ],
  rateLimit: 100,
  rateWindow: 60_000,
  healthInterval: 15_000,
});

// Start simulated health checks
lb.startHealthChecks();

// ── Serve Static Dashboard ───────────────────────────────────

app.use(express.static(path.join(__dirname, "public")));

// ── API Routes ───────────────────────────────────────────────

// Route a specific IP
app.post("/api/route", (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: "Missing `ip` in request body" });
  }

  const result = lb.route(ip);
  if (!result) {
    return res.status(503).json({ error: "No healthy nodes available" });
  }

  if (result.rateLimited) {
    return res.status(429).json({
      error: "Rate limited",
      ip,
      retryAfter: lb.rateLimiter.getInfo(ip).resetIn,
    });
  }

  res.json({
    ip,
    node: result.node,
    hashValue: result.hashValue,
    fallback: result.fallback,
  });
});

// Route with auto-generated random IP
app.get("/api/route/random", (_req, res) => {
  const ip = generateRandomIP();
  const result = lb.route(ip);

  if (!result) {
    return res.status(503).json({ error: "No healthy nodes available" });
  }

  res.json({
    ip,
    node: result.node,
    hashValue: result.hashValue,
    fallback: result.fallback,
  });
});

// Full system status
app.get("/api/status", (_req, res) => {
  res.json(lb.getStatus());
});

// Metrics snapshot
app.get("/api/metrics", (_req, res) => {
  res.json(lb.metrics.getSnapshot());
});

// Health status
app.get("/api/health", (_req, res) => {
  res.json(lb.healthChecker.getStatus());
});

// Add a node
app.post("/api/nodes", (req, res) => {
  const { name, weight = 1 } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Missing `name` in request body" });
  }

  lb.addNode(name, weight);
  res.json({ message: `Added ${name} with weight ${weight}`, nodes: lb.nodes });
});

// Remove a node
app.delete("/api/nodes/:name", (req, res) => {
  const { name } = req.params;
  lb.removeNode(name);
  res.json({ message: `Removed ${name}`, nodes: lb.nodes });
});

// Update node weight
app.put("/api/nodes/:name/weight", (req, res) => {
  const { name } = req.params;
  const { weight } = req.body;

  if (weight === undefined || weight < 1) {
    return res
      .status(400)
      .json({ error: "Weight must be a positive integer" });
  }

  lb.updateWeight(name, weight);
  res.json({ message: `Updated ${name} weight to ${weight}` });
});

// Mark node down
app.put("/api/nodes/:name/down", (req, res) => {
  const { name } = req.params;
  lb.markNodeDown(name);
  res.json({ message: `${name} marked as DOWN` });
});

// Mark node up
app.put("/api/nodes/:name/up", (req, res) => {
  const { name } = req.params;
  lb.markNodeUp(name);
  res.json({ message: `${name} marked as UP` });
});

// Simulate N requests
app.post("/api/simulate", (req, res) => {
  const { count = 10 } = req.body;
  const results = [];

  for (let i = 0; i < Math.min(count, 1000); i++) {
    const ip = generateRandomIP();
    const result = lb.route(ip);
    if (result && !result.rateLimited) {
      results.push({ ip, node: result.node });
    }
  }

  res.json({
    message: `Simulated ${results.length} requests`,
    results,
    metrics: lb.metrics.getSnapshot(),
  });
});

// ── Serve Dashboard (catch-all) ──────────────────────────────

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start Server ─────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logInfo(`🚀 Load Balancer API running on http://localhost:${PORT}`);
  logInfo(`📊 Dashboard available at http://localhost:${PORT}`);
  logInfo(`📡 API base: http://localhost:${PORT}/api`);
  console.log("");
});

// Graceful shutdown
process.on("SIGINT", () => {
  logInfo("Shutting down…");
  lb.shutdown();
  process.exit(0);
});

module.exports = app;
