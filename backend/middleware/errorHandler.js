import { logger } from "../utils/logger.js";
import { isDatabaseError } from "../db/pool.js";

export default function errorHandler(error, req, res, _next) {
  const databaseUnavailable = error.statusCode === 503 || isDatabaseError(error);
  const statusCode = databaseUnavailable ? 503 : error.statusCode || 500;
  const message = databaseUnavailable ? error.publicMessage || "Database temporarily unavailable. The API is starting up or reconnecting." : statusCode === 500 ? "Internal server error" : error.message;
  const requestId = req.requestId || "unknown";

  if (databaseUnavailable) {
    logger.error({ requestId, url: req.originalUrl, method: req.method, error: error.message, code: error.code }, "Database Unavailable");
  } else if (statusCode === 500) {
    logger.error({ requestId, url: req.originalUrl, method: req.method, error: error.message, stack: error.stack }, "Unhandled Server Error");
  } else {
    logger.warn({ requestId, url: req.originalUrl, method: req.method, statusCode, message }, "Client/Operational Request Exception");
  }

  res.status(statusCode).json({ error: message, code: databaseUnavailable ? "API_DATABASE_UNAVAILABLE" : undefined, retryable: databaseUnavailable || undefined, requestId });
}
