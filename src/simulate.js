// ============================================================
//  simulate.js – CLI Simulation Runner
// ============================================================
//  Run with:  npm run simulate
//
//  Demonstrates:
//  1. Basic traffic routing with consistent hashing
//  2. Same IP always hits the same node (determinism proof)
//  3. Node addition / removal with minimal key remapping
//  4. Weighted routing (Node-B gets 3× traffic)
//  5. Health-check failover
//  6. Rate limiting in action
//  7. Final metrics summary
// ============================================================

const {
  LoadBalancer,
  generateRandomIP,
  simulateTraffic,
} = require("./core/loadBalancer");

// ── Pretty Divider ──────────────────────────────────────────

const SEP = "\n" + "═".repeat(60) + "\n";

function header(title) {
  console.log(SEP);
  console.log(`  🔷  ${title}`);
  console.log("═".repeat(60));
}

// ── Main Simulation ─────────────────────────────────────────

(function main() {
  // ─── 1. Initialize ─────────────────────────────────────────
  header("1. Initialize Load Balancer (3 equally-weighted nodes)");

  const lb = new LoadBalancer({
    nodes: [
      { name: "Node-A", weight: 1 },
      { name: "Node-B", weight: 1 },
      { name: "Node-C", weight: 1 },
    ],
    rateLimit: 5, // 5 requests per minute per IP (low for demo)
    rateWindow: 60_000,
  });

  // ─── 2. Simulate 10 random requests ────────────────────────
  header("2. Simulate 10 Random Requests");
  simulateTraffic(lb, 10);

  // ─── 3. Prove determinism: same IP → same node ─────────────
  header("3. Determinism Proof – Same IP Always → Same Node");

  const testIP = "192.168.1.42";
  console.log(`\n  Testing IP: ${testIP}  (5 consecutive requests)\n`);

  for (let i = 0; i < 5; i++) {
    lb.route(testIP);
  }

  // ─── 4. Add a new node → minimal remapping ────────────────
  header("4. Add Node-D → Minimal Key Remapping");

  const beforeAdd = lb.route("10.0.0.1");
  lb.addNode("Node-D", 1);
  const afterAdd = lb.route("10.0.0.1");

  console.log(
    `\n  IP 10.0.0.1 before Node-D: ${beforeAdd?.node}`
  );
  console.log(
    `  IP 10.0.0.1 after  Node-D: ${afterAdd?.node}`
  );
  console.log(
    beforeAdd?.node === afterAdd?.node
      ? "  ✅ Same node (no remapping for this IP)"
      : "  ↪️  Remapped (expected for some IPs when topology changes)"
  );

  // ─── 5. Remove a node ─────────────────────────────────────
  header("5. Remove Node-C → Traffic Redistributed");

  lb.removeNode("Node-C");
  simulateTraffic(lb, 5);

  // ─── 6. Weighted Routing ───────────────────────────────────
  header("6. Weighted Routing – Node-B Gets 3× Weight");

  lb.updateWeight("Node-B", 3);
  console.log("\n  Sending 20 requests to show weighted distribution:\n");
  simulateTraffic(lb, 20);

  // ─── 7. Health-Check Failover ──────────────────────────────
  header("7. Health-Check Failover – Node-A Goes Down");

  lb.markNodeDown("Node-A");
  console.log("\n  Requests that would go to Node-A will be rerouted:\n");
  simulateTraffic(lb, 5);

  lb.markNodeUp("Node-A");
  console.log("\n  Node-A is back UP:\n");
  simulateTraffic(lb, 3);

  // ─── 8. Rate Limiting ─────────────────────────────────────
  header("8. Rate Limiting – Flooding from Single IP");

  const floodIP = "10.10.10.10";
  console.log(
    `\n  Sending 8 requests from ${floodIP} (limit = 5/min):\n`
  );

  for (let i = 0; i < 8; i++) {
    const result = lb.route(floodIP);
    if (result?.rateLimited) {
      console.log(`  ❌ Request ${i + 1} from ${floodIP}: RATE LIMITED`);
    } else {
      console.log(
        `  ✅ Request ${i + 1} from ${floodIP}: → ${result?.node}`
      );
    }
  }

  // ─── 9. Final Metrics Summary ─────────────────────────────
  header("9. Final Metrics Summary");

  const status = lb.getStatus();

  console.log("\n  📊 Metrics:");
  console.log(`     Total Requests    : ${status.metrics.totalRequests}`);
  console.log(`     Rate Limited      : ${status.metrics.rateLimited}`);
  console.log(`     Fallback Routes   : ${status.metrics.fallbacks}`);
  console.log(`     Uptime (seconds)  : ${status.metrics.uptime}`);

  console.log("\n  📦 Per-Node Distribution:");
  for (const [node, count] of Object.entries(status.metrics.perNode)) {
    const bar = "█".repeat(Math.ceil(count / 2));
    console.log(`     ${node.padEnd(10)} : ${String(count).padStart(3)} ${bar}`);
  }

  console.log("\n  🏥 Node Health:");
  for (const node of status.nodes) {
    const icon = node.healthy ? "🟢" : "🔴";
    console.log(
      `     ${icon} ${node.name.padEnd(10)} weight=${node.weight}  ${
        node.healthy ? "healthy" : "DOWN"
      }`
    );
  }

  console.log(SEP);

  // Cleanup
  lb.shutdown();
})();
