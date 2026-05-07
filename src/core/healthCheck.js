// ============================================================
//  healthCheck.js – Node Health Monitor
// ============================================================
//  Simulates periodic health checks on backend nodes.
//
//  In a real system you'd ping an HTTP endpoint or TCP port.
//  Here we use a simple in-memory simulation where nodes
//  can be manually marked up / down, and a background timer
//  randomly toggles health to demonstrate failover behaviour.
// ============================================================

const { logHealthCheck, logWarn } = require("../utils/logger");

class HealthChecker {
  /**
   * @param {string[]} nodes           – initial list of node names
   * @param {number}   [intervalMs=10000] – how often to run checks (ms)
   * @param {number}   [failRate=0.05] – simulated failure probability per check
   */
  constructor(nodes, intervalMs = 10000, failRate = 0.05) {
    // Map<nodeName, boolean>  –  true = healthy
    this.status = new Map();
    this.intervalMs = intervalMs;
    this.failRate = failRate;
    this._timer = null;

    // All nodes start healthy
    for (const node of nodes) {
      this.status.set(node, true);
    }
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Is the given node currently healthy?
   * @param {string} node
   * @returns {boolean}
   */
  isHealthy(node) {
    return this.status.get(node) === true;
  }

  /**
   * Get only the healthy nodes.
   * @returns {string[]}
   */
  getHealthyNodes() {
    return [...this.status.entries()]
      .filter(([, alive]) => alive)
      .map(([node]) => node);
  }

  /**
   * Get full status map.
   * @returns {Object}
   */
  getStatus() {
    const result = {};
    for (const [node, alive] of this.status) {
      result[node] = alive ? "healthy" : "down";
    }
    return result;
  }

  /**
   * Manually mark a node as UP.
   * @param {string} node
   */
  markUp(node) {
    this.status.set(node, true);
    logHealthCheck(node, true);
  }

  /**
   * Manually mark a node as DOWN.
   * @param {string} node
   */
  markDown(node) {
    this.status.set(node, false);
    logHealthCheck(node, false);
  }

  /**
   * Add a new node to monitoring.
   * @param {string} node
   */
  addNode(node) {
    if (!this.status.has(node)) {
      this.status.set(node, true);
    }
  }

  /**
   * Remove a node from monitoring.
   * @param {string} node
   */
  removeNode(node) {
    this.status.delete(node);
  }

  /**
   * Start periodic simulated health checks.
   */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._check(), this.intervalMs);
  }

  /**
   * Stop periodic checks.
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  // ── Internals ──────────────────────────────────────────────

  /**
   * Simulate a health check round.
   * Each node has `failRate` chance of going down and
   * a recovery chance of coming back up.
   */
  _check() {
    for (const [node, alive] of this.status) {
      if (alive) {
        // Small chance the node goes down
        if (Math.random() < this.failRate) {
          this.status.set(node, false);
          logHealthCheck(node, false);
          logWarn(`${node} is now UNREACHABLE — traffic will be rerouted`);
        }
      } else {
        // Higher chance to recover (80%)
        if (Math.random() < 0.8) {
          this.status.set(node, true);
          logHealthCheck(node, true);
        }
      }
    }
  }
}

module.exports = { HealthChecker };
