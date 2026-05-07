// ============================================================
//  metrics.js – In-Memory Metrics Collector
// ============================================================
//  Tracks request counts, latency, and per-node distribution
//  so the dashboard can display real-time stats.
// ============================================================

class MetricsCollector {
  constructor() {
    // Total requests handled
    this.totalRequests = 0;

    // Per-node counters  Map<nodeName, number>
    this.perNode = new Map();

    // Rate-limited request count
    this.rateLimited = 0;

    // Fallback (re-routed) count
    this.fallbacks = 0;

    // Recent request log (ring buffer – keep last 200)
    this.recentRequests = [];
    this.maxRecent = 200;

    // Requests per second tracking
    this._timestamps = [];

    // Start time
    this.startTime = Date.now();
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Record a successfully routed request.
   * @param {string} ip
   * @param {string} node
   * @param {number} hashValue
   * @param {boolean} [wasFallback=false]
   */
  recordRequest(ip, node, hashValue, wasFallback = false) {
    this.totalRequests++;
    this.perNode.set(node, (this.perNode.get(node) || 0) + 1);

    if (wasFallback) this.fallbacks++;

    const entry = {
      timestamp: new Date().toISOString(),
      ip,
      node,
      hashValue,
      wasFallback,
    };

    this.recentRequests.push(entry);
    if (this.recentRequests.length > this.maxRecent) {
      this.recentRequests.shift();
    }

    // Track timestamp for RPS calculation
    this._timestamps.push(Date.now());
    // Keep only last 60 seconds of timestamps
    const cutoff = Date.now() - 60_000;
    this._timestamps = this._timestamps.filter((t) => t > cutoff);
  }

  /**
   * Record a rate-limited request.
   */
  recordRateLimited() {
    this.rateLimited++;
  }

  /**
   * Get the current requests per second (over last 60s).
   * @returns {number}
   */
  getRPS() {
    const now = Date.now();
    const cutoff = now - 60_000;
    const recent = this._timestamps.filter((t) => t > cutoff);
    const elapsed = Math.min(60, (now - this.startTime) / 1000);
    return elapsed > 0 ? +(recent.length / elapsed).toFixed(2) : 0;
  }

  /**
   * Get a full snapshot of all metrics.
   * @returns {Object}
   */
  getSnapshot() {
    const perNodeObj = {};
    for (const [node, count] of this.perNode) {
      perNodeObj[node] = count;
    }

    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      totalRequests: this.totalRequests,
      rateLimited: this.rateLimited,
      fallbacks: this.fallbacks,
      requestsPerSecond: this.getRPS(),
      perNode: perNodeObj,
      recentRequests: this.recentRequests.slice(-50), // last 50
    };
  }
}

module.exports = { MetricsCollector };
