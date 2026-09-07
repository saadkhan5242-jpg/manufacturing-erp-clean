import { logger } from "../utils/logger.js";

export default function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Internal server error" : error.message;
  const requestId = req.requestId || "unknown";

  if (statusCode === 500) {
    logger.error({ requestId, url: req.originalUrl, method: req.method, error: error.message, stack: error.stack }, "Unhandled Server Error");
  } else {
    logger.warn({ requestId, url: req.originalUrl, method: req.method, statusCode, message }, "Client/Operational Request Exception");
  }

  res.status(statusCode).json({ error: message, requestId });
}
