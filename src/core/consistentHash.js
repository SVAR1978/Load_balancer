// ============================================================
//  consistentHash.js – Consistent Hashing Ring
// ============================================================
//
//  WHY Consistent Hashing?
//  ─────────────────────────
//  • Determinism  – the same IP ALWAYS lands on the same node.
//  • Stability    – when a node is added / removed, only ~1/N
//                   of keys are remapped (not all of them).
//  • Fairness     – virtual nodes spread load evenly, even
//                   when physical nodes have different weights.
//
//  HOW IT WORKS (simple explanation):
//  ───────────────────────────────────
//  1. Imagine a circle (ring) numbered 0 → 2^32.
//  2. Each server node is hashed to MULTIPLE positions on the
//     ring (these are called "virtual nodes" or "vnodes").
//     More vnodes → more even distribution.
//  3. To route a request, hash the client IP and walk CLOCKWISE
//     around the ring until we hit the first vnode.  The
//     physical node that owns that vnode handles the request.
//
//  Weighted routing is built-in: a node with weight 3 gets 3×
//  as many vnodes as a node with weight 1 → it naturally
//  receives ~3× the traffic.
// ============================================================

const { hash } = require("../utils/hash");

// Default number of virtual nodes PER UNIT of weight
const DEFAULT_VNODES = 150;

class ConsistentHashRing {
  /**
   * @param {number} [vnodeCount=150] – virtual nodes per weight unit
   */
  constructor(vnodeCount = DEFAULT_VNODES) {
    this.vnodeCount = vnodeCount;

    // Sorted array of { position: number, node: string }
    this.ring = [];

    // Map<nodeName, weight>  – tracks every physical node
    this.nodeWeights = new Map();
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Add a physical node to the ring.
   * @param {string} node   – e.g. "Node-A"
   * @param {number} weight – relative weight (default 1)
   */
  addNode(node, weight = 1) {
    if (this.nodeWeights.has(node)) return; // idempotent
    this.nodeWeights.set(node, weight);
    this._addVnodes(node, weight);
    this._sortRing();
  }

  /**
   * Remove a physical node from the ring.
   * @param {string} node
   */
  removeNode(node) {
    if (!this.nodeWeights.has(node)) return;
    this.nodeWeights.delete(node);
    this.ring = this.ring.filter((entry) => entry.node !== node);
  }

  /**
   * Get the node that should handle the given key.
   * Uses clockwise walk on the hash ring.
   *
   * @param {string} key – e.g. an IP address
   * @returns {{ node: string, hashValue: number } | null}
   */
  getNode(key) {
    if (this.ring.length === 0) return null;

    const keyHash = hash(key);

    // Binary search for the first vnode whose position >= keyHash
    let lo = 0;
    let hi = this.ring.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ring[mid].position < keyHash) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    // Wrap around to the beginning of the ring if needed
    const idx = lo % this.ring.length;
    return {
      node: this.ring[idx].node,
      hashValue: keyHash,
    };
  }

  /**
   * List all physical nodes currently on the ring.
   * @returns {string[]}
   */
  getNodes() {
    return Array.from(this.nodeWeights.keys());
  }

  /**
   * Return the number of vnodes on the ring.
   * @returns {number}
   */
  get size() {
    return this.ring.length;
  }

  // ── Internals ──────────────────────────────────────────────

  /**
   * Add virtual nodes for a physical node.
   */
  _addVnodes(node, weight) {
    const count = this.vnodeCount * weight;
    for (let i = 0; i < count; i++) {
      const virtualKey = `${node}#vnode${i}`;
      const position = hash(virtualKey);
      this.ring.push({ position, node });
    }
  }

  /**
   * Keep the ring sorted by position for binary search.
   */
  _sortRing() {
    this.ring.sort((a, b) => a.position - b.position);
  }
}

module.exports = { ConsistentHashRing };
