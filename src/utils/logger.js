// ============================================================
//  logger.js – Structured, colour-coded request logging
// ============================================================
//  Provides timestamped, leveled logging with colour support.
//  In production you'd swap this for Winston / Pino, but this
//  keeps the project dependency-light and beginner-friendly.
// ============================================================

// ANSI colour codes for terminal output
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

/**
 * Get a formatted ISO timestamp string.
 * @returns {string}
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Log a routed-request entry.
 * @param {string} ip           – client IP
 * @param {string} selectedNode – node the request was sent to
 * @param {number} hashValue    – position on the hash ring
 */
function logRoute(ip, selectedNode, hashValue) {
  console.log(
    `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.cyan}ROUTE${COLORS.reset}  ` +
      `${COLORS.white}IP ${COLORS.bright}${ip}${COLORS.reset} ` +
      `${COLORS.dim}(hash ${hashValue})${COLORS.reset} ` +
      `→ ${COLORS.green}${COLORS.bright}${selectedNode}${COLORS.reset}`
  );
}

/**
 * Log a health-check event.
 * @param {string} node   – node name
 * @param {boolean} alive – whether the node is healthy
 */
function logHealthCheck(node, alive) {
  const status = alive
    ? `${COLORS.bgGreen}${COLORS.bright} HEALTHY ${COLORS.reset}`
    : `${COLORS.bgRed}${COLORS.bright} DOWN    ${COLORS.reset}`;
  console.log(
    `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.magenta}HEALTH${COLORS.reset} ${node} ${status}`
  );
}

/**
 * Log a rate-limit rejection.
 * @param {string} ip – the throttled IP
 */
function logRateLimit(ip) {
  console.log(
    `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.bgYellow}${COLORS.bright} RATE-LIMITED ${COLORS.reset} ` +
      `${COLORS.red}${ip}${COLORS.reset} – request denied`
  );
}

/**
 * General informational log.
 * @param {string} message
 */
function logInfo(message) {
  console.log(
    `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.blue}INFO${COLORS.reset}   ${message}`
  );
}

/**
 * Warning log.
 * @param {string} message
 */
function logWarn(message) {
  console.log(
    `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.yellow}WARN${COLORS.reset}   ${message}`
  );
}

/**
 * Error log.
 * @param {string} message
 */
function logError(message) {
  console.log(
    `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.red}ERROR${COLORS.reset}  ${message}`
  );
}

module.exports = {
  logRoute,
  logHealthCheck,
  logRateLimit,
  logInfo,
  logWarn,
  logError,
};
