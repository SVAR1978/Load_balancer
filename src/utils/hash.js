// ============================================================
//  hash.js – Deterministic hash function for Consistent Hashing
// ============================================================
//  Uses the built-in Node.js `crypto` module (SHA-256) so we
//  get a cryptographically strong, uniformly distributed hash
//  that ensures every IP always maps to the same position on
//  the hash ring — even across restarts.
// ============================================================

const crypto = require("crypto");

/**
 * Compute a 32-bit unsigned integer hash of the given key.
 *
 * How it works:
 * 1. SHA-256 produces a 256-bit digest (32 bytes).
 * 2. We take the first 4 bytes and read them as an unsigned
 *    32-bit big-endian integer → a number in [0, 2^32 - 1].
 *
 * This is deterministic: the same `key` always returns the
 * same number, which is exactly what consistent hashing needs.
 *
 * @param {string} key – any string (IP address, node name, …)
 * @returns {number}   – unsigned 32-bit integer
 */
function hash(key) {
  const digest = crypto.createHash("sha256").update(key).digest();
  // Read the first 4 bytes as a big-endian unsigned 32-bit int
  return digest.readUInt32BE(0);
}

module.exports = { hash };
