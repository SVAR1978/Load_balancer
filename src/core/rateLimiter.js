// ============================================================
//  rateLimiter.js – Token-Bucket Rate Limiter
// ============================================================
//  Limits the number of requests each client IP can make
//  within a sliding time window.
//
//  Algorithm: Fixed Window Counter
//  ───────────────────────────────
//  • Each IP gets an entry: { count, windowStart }
//  • If the current time is still inside the window AND
//    count >= maxRequests → reject.
//  • Once the window expires, the counter resets.
//
//  This is deliberately simple; for production you'd use
//  a sliding-window or token-bucket backed by Redis.
// ============================================================

const { logRateLimit } = require("../utils/logger");

class RateLimiter {
  /**
   * @param {number} maxRequests       – allowed requests per window
   * @param {number} windowMs          – window duration in milliseconds
   */
  constructor(maxRequests = 10, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Map<ip, { count: number, windowStart: number }>
    this.clients = new Map();

    // Periodically clean up expired entries to avoid memory leaks
    this._cleanupTimer = setInterval(() => this._cleanup(), windowMs * 2);
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Check whether the request from `ip` is allowed.
   * Returns true if allowed, false if rate-limited.
   *
   * @param {string} ip
   * @returns {boolean}
   */
  allow(ip) {
    const now = Date.now();
    let entry = this.clients.get(ip);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      // First request or window expired — reset
      entry = { count: 1, windowStart: now };
      this.clients.set(ip, entry);
      return true;
    }

    entry.count++;

    if (entry.count > this.maxRequests) {
      logRateLimit(ip);
      return false;
    }

    return true;
  }

  /**
   * Get rate-limit info for an IP.
   * @param {string} ip
   * @returns {{ remaining: number, resetIn: number }}
   */
  getInfo(ip) {
    const now = Date.now();
    const entry = this.clients.get(ip);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      return { remaining: this.maxRequests, resetIn: 0 };
    }

    return {
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetIn: Math.max(0, this.windowMs - (now - entry.windowStart)),
    };
  }

  /**
   * Get global rate-limiter stats.
   * @returns {Object}
   */
  getStats() {
    const now = Date.now();
    let activeClients = 0;
    let throttledClients = 0;

    for (const [, entry] of this.clients) {
      if (now - entry.windowStart < this.windowMs) {
        activeClients++;
        if (entry.count > this.maxRequests) throttledClients++;
      }
    }

    return {
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      activeClients,
      throttledClients,
    };
  }

  /**
   * Stop the cleanup timer (for graceful shutdown).
   */
  stop() {
    clearInterval(this._cleanupTimer);
  }

  // ── Internals ──────────────────────────────────────────────

  /**
   * Remove expired entries from memory.
   */
  _cleanup() {
    const now = Date.now();
    for (const [ip, entry] of this.clients) {
      if (now - entry.windowStart >= this.windowMs * 2) {
        this.clients.delete(ip);
      }
    }
  }
}

module.exports = { RateLimiter };
