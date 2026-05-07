// ============================================================
//  loadBalancer.js – The Main Load Balancer Engine
// ============================================================
//  Combines:
//    • Consistent Hashing   (deterministic IP → node mapping)
//    • Health Checking       (skip unhealthy nodes, fallback)
//    • Weighted Routing      (priority-based virtual nodes)
//    • Rate Limiting         (per-IP request throttling)
//    • Metrics Collection    (real-time stats & logging)
//
//  This module is the heart of the system.  The Express server
//  (server.js) and the CLI simulator (simulate.js) both use it.
// ============================================================

const { ConsistentHashRing } = require("./consistentHash");
const { HealthChecker } = require("./healthCheck");
const { RateLimiter } = require("./rateLimiter");
const { MetricsCollector } = require("./metrics");
const { logRoute, logWarn, logInfo, logError } = require("../utils/logger");

// ── Random IP Generator (provided) ──────────────────────────

/**
 * Generate a random IPv4 address.
 * @returns {string} e.g. "172.45.231.8"
 */
function generateRandomIP() {
  return Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 256)
  ).join(".");
}

// ── Default node configuration ──────────────────────────────

const DEFAULT_NODES = [
  { name: "Node-A", weight: 1 },
  { name: "Node-B", weight: 1 },
  { name: "Node-C", weight: 1 },
];

// ── Load Balancer Class ─────────────────────────────────────

class LoadBalancer {
  /**
   * @param {Object}   [options]
   * @param {Array}    [options.nodes]        – [{ name, weight }]
   * @param {number}   [options.vnodeCount]   – vnodes per weight unit
   * @param {number}   [options.rateLimit]    – max reqs per window per IP
   * @param {number}   [options.rateWindow]   – window size in ms
   * @param {number}   [options.healthInterval] – health-check interval ms
   */
  constructor(options = {}) {
    const {
      nodes = DEFAULT_NODES,
      vnodeCount = 150,
      rateLimit = 20,
      rateWindow = 60_000,
      healthInterval = 15_000,
    } = options;

    // ── Initialize subsystems ──────────────────────────────

    // 1. Consistent Hash Ring
    this.ring = new ConsistentHashRing(vnodeCount);

    // 2. Health Checker
    this.healthChecker = new HealthChecker(
      nodes.map((n) => n.name),
      healthInterval
    );

    // 3. Rate Limiter
    this.rateLimiter = new RateLimiter(rateLimit, rateWindow);

    // 4. Metrics
    this.metrics = new MetricsCollector();

    // 5. Node list reference
    this.nodes = [...nodes];

    // Populate the hash ring with weighted nodes
    for (const { name, weight } of nodes) {
      this.ring.addNode(name, weight);
    }

    logInfo(
      `Load Balancer initialized with ${nodes.length} nodes ` +
        `(${this.ring.size} vnodes on ring)`
    );
  }

  // ── Core: Route a request ─────────────────────────────────

  /**
   * Route an incoming request to the appropriate node.
   *
   * This is the REDESIGNED LoadBalancer function that replaces
   * the original random-selection strategy.
   *
   * Algorithm:
   * 1. Rate-limit check → reject if exceeded.
   * 2. Hash the IP → find primary node on the ring.
   * 3. If primary node is DOWN → walk the ring to find the
   *    next healthy node (fallback).
   * 4. Log the routing decision.
   * 5. Record metrics.
   *
   * @param {string} ip – client IP address
   * @returns {{ node: string, hashValue: number, rateLimited: boolean, fallback: boolean } | null}
   */
  route(ip) {
    // ── Step 1: Rate Limiting ────────────────────────────
    if (!this.rateLimiter.allow(ip)) {
      this.metrics.recordRateLimited();
      return { node: null, hashValue: 0, rateLimited: true, fallback: false };
    }

    // ── Step 2: Consistent Hash Lookup ───────────────────
    const result = this.ring.getNode(ip);
    if (!result) {
      logError("No nodes available on the hash ring!");
      return null;
    }

    const { node: primaryNode, hashValue } = result;

    // ── Step 3: Health Check & Fallback ──────────────────
    let selectedNode = primaryNode;
    let wasFallback = false;

    if (!this.healthChecker.isHealthy(primaryNode)) {
      // Find next healthy node by walking the ring
      const healthyNodes = this.healthChecker.getHealthyNodes();

      if (healthyNodes.length === 0) {
        logError("ALL nodes are DOWN — cannot route request!");
        return null;
      }

      // Pick the best fallback: hash the IP with a suffix and
      // find a healthy node on the ring
      for (let attempt = 0; attempt < this.nodes.length; attempt++) {
        const fallbackResult = this.ring.getNode(`${ip}#fallback${attempt}`);
        if (
          fallbackResult &&
          this.healthChecker.isHealthy(fallbackResult.node)
        ) {
          selectedNode = fallbackResult.node;
          wasFallback = true;
          break;
        }
      }

      // Last resort: just pick first healthy node
      if (!this.healthChecker.isHealthy(selectedNode)) {
        selectedNode = healthyNodes[0];
        wasFallback = true;
      }

      logWarn(
        `${primaryNode} is DOWN → Falling back to ${selectedNode} for IP ${ip}`
      );
    }

    // ── Step 4: Identify which node received the request ─
    identifyNode(ip, selectedNode);

    // ── Step 5: Logging ──────────────────────────────────
    logRoute(ip, selectedNode, hashValue);

    // ── Step 6: Metrics ──────────────────────────────────
    this.metrics.recordRequest(ip, selectedNode, hashValue, wasFallback);

    return {
      node: selectedNode,
      hashValue,
      rateLimited: false,
      fallback: wasFallback,
    };
  }

  // ── Node Management ────────────────────────────────────────

  /**
   * Add a new node to the load balancer.
   * @param {string} name
   * @param {number} [weight=1]
   */
  addNode(name, weight = 1) {
    this.ring.addNode(name, weight);
    this.healthChecker.addNode(name);
    this.nodes.push({ name, weight });
    logInfo(
      `Added ${name} (weight=${weight}) → ring now has ${this.ring.size} vnodes`
    );
  }

  /**
   * Remove a node from the load balancer.
   * @param {string} name
   */
  removeNode(name) {
    this.ring.removeNode(name);
    this.healthChecker.removeNode(name);
    this.nodes = this.nodes.filter((n) => n.name !== name);
    logInfo(`Removed ${name} → ring now has ${this.ring.size} vnodes`);
  }

  /**
   * Update the weight of an existing node.
   * Rebuilds its vnodes on the ring.
   * @param {string} name
   * @param {number} newWeight
   */
  updateWeight(name, newWeight) {
    this.ring.removeNode(name);
    this.ring.addNode(name, newWeight);
    const node = this.nodes.find((n) => n.name === name);
    if (node) node.weight = newWeight;
    logInfo(`Updated ${name} weight to ${newWeight}`);
  }

  // ── Health Management ──────────────────────────────────────

  markNodeDown(name) {
    this.healthChecker.markDown(name);
  }

  markNodeUp(name) {
    this.healthChecker.markUp(name);
  }

  startHealthChecks() {
    this.healthChecker.start();
    logInfo("Periodic health checks started");
  }

  stopHealthChecks() {
    this.healthChecker.stop();
  }

  // ── Info ────────────────────────────────────────────────────

  /**
   * Get full system status.
   * @returns {Object}
   */
  getStatus() {
    return {
      nodes: this.nodes.map((n) => ({
        name: n.name,
        weight: n.weight,
        healthy: this.healthChecker.isHealthy(n.name),
      })),
      ringSize: this.ring.size,
      health: this.healthChecker.getStatus(),
      rateLimiter: this.rateLimiter.getStats(),
      metrics: this.metrics.getSnapshot(),
    };
  }

  /**
   * Graceful shutdown.
   */
  shutdown() {
    this.healthChecker.stop();
    this.rateLimiter.stop();
    logInfo("Load Balancer shut down gracefully");
  }
}

// ── Identify Node (provided) ────────────────────────────────

/**
 * Identify which node received the request.
 * @param {string} ip
 * @param {string} selectedNode
 */
function identifyNode(ip, selectedNode) {
  console.log(`Incoming IP: ${ip} → Routed to: ${selectedNode}`);
}

// ── Simulate Traffic (provided) ─────────────────────────────

/**
 * Simulate incoming traffic hitting the load balancer.
 * @param {LoadBalancer} lb
 * @param {number} requestCount
 */
function simulateTraffic(lb, requestCount = 5) {
  for (let i = 0; i < requestCount; i++) {
    const ip = generateRandomIP();
    lb.route(ip);
  }
}

module.exports = {
  LoadBalancer,
  generateRandomIP,
  identifyNode,
  simulateTraffic,
};
