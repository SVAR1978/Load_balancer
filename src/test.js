// ============================================================
//  test.js – Verification Tests for Consistent Hashing
// ============================================================

const { ConsistentHashRing } = require("./core/consistentHash");
const { LoadBalancer, generateRandomIP } = require("./core/loadBalancer");

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ FAIL: ${msg}`); }
}

console.log("\n═══ Test Suite: Consistent Hash Load Balancer ═══\n");

// Test 1: Determinism
console.log("▸ Test 1: Same IP always maps to same node");
const ring = new ConsistentHashRing(100);
["Node-A","Node-B","Node-C"].forEach(n => ring.addNode(n));
const ip = "192.168.1.100";
const first = ring.getNode(ip);
for (let i = 0; i < 100; i++) {
  assert(ring.getNode(ip).node === first.node, `Attempt ${i+1}: ${ip} → ${first.node}`);
}

// Test 2: Distribution
console.log("\n▸ Test 2: Requests are distributed across all nodes");
const counts = {};
for (let i = 0; i < 10000; i++) {
  const n = ring.getNode(generateRandomIP()).node;
  counts[n] = (counts[n] || 0) + 1;
}
for (const [n, c] of Object.entries(counts)) {
  const pct = (c / 100).toFixed(1);
  assert(c > 1000, `${n}: ${c} requests (${pct}%) – should be > 10%`);
}

// Test 3: Minimal remapping on node addition
console.log("\n▸ Test 3: Adding a node causes minimal remapping");
const ips = Array.from({ length: 1000 }, () => generateRandomIP());
const before = ips.map(i => ring.getNode(i).node);
ring.addNode("Node-D");
const after = ips.map(i => ring.getNode(i).node);
let remapped = 0;
for (let i = 0; i < ips.length; i++) { if (before[i] !== after[i]) remapped++; }
const remapPct = (remapped / ips.length * 100).toFixed(1);
assert(remapped < ips.length * 0.5, `Only ${remapPct}% remapped (< 50% threshold)`);

// Test 4: Weighted routing
console.log("\n▸ Test 4: Weighted node gets more traffic");
const wRing = new ConsistentHashRing(100);
wRing.addNode("Light", 1);
wRing.addNode("Heavy", 5);
const wCounts = { Light: 0, Heavy: 0 };
for (let i = 0; i < 5000; i++) {
  wCounts[wRing.getNode(generateRandomIP()).node]++;
}
assert(wCounts.Heavy > wCounts.Light * 2, `Heavy(${wCounts.Heavy}) > 2× Light(${wCounts.Light})`);

// Test 5: LoadBalancer rate limiting
console.log("\n▸ Test 5: Rate limiting blocks excess requests");
const lb = new LoadBalancer({ rateLimit: 3, rateWindow: 60000 });
const testIP = "10.0.0.1";
for (let i = 0; i < 3; i++) { lb.route(testIP); }
const blocked = lb.route(testIP);
assert(blocked?.rateLimited === true, "4th request is rate-limited");
lb.shutdown();

// Summary
console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
