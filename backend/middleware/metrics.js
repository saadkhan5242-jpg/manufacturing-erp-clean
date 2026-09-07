import { logger } from "../utils/logger.js";

const metricsStore = {
  requestCount: 0,
  errorCount: 0,
  activeRequests: 0,
  latencyHistogram: [],
  endpointUsage: {}
};

export function metricsMiddleware(req, res, next) {
  metricsStore.requestCount++;
  metricsStore.activeRequests++;
  const startTime = process.hrtime();

  res.on("finish", () => {
    metricsStore.activeRequests--;
    const diff = process.hrtime(startTime);
    const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6);

    const pathKey = `${req.method} ${req.baseUrl || req.path}`;
    metricsStore.endpointUsage[pathKey] = (metricsStore.endpointUsage[pathKey] || 0) + 1;

    if (res.statusCode >= 400) {
      metricsStore.errorCount++;
    }

    if (metricsStore.latencyHistogram.length > 1000) {
      metricsStore.latencyHistogram.shift();
    }
    metricsStore.latencyHistogram.push(timeInMs);
  });

  next();
}

export function getMetrics() {
  const count = metricsStore.latencyHistogram.length;
  const avgLatency = count > 0 ? (metricsStore.latencyHistogram.reduce((a, b) => a + b, 0) / count).toFixed(2) : 0;

  return {
    uptimeSeconds: process.uptime(),
    totalRequests: metricsStore.requestCount,
    totalErrors: metricsStore.errorCount,
    activeRequests: metricsStore.activeRequests,
    avgLatencyMs: Number(avgLatency),
    memoryUsageMb: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
    endpointUsage: metricsStore.endpointUsage
  };
}
