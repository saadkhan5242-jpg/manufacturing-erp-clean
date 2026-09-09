import { ZodError } from "zod";

/**
 * Higher-order middleware function to validate incoming req.body against a Zod schema.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((err) => `${err.path.join(".")}: ${err.message}`);
        return res.status(400).json({
          error: "Validation Error",
          details: issues,
          requestId: req.requestId
        });
      }
      return res.status(400).json({ error: "Invalid request payload", requestId: req.requestId });
    }
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((err) => `${err.path.join(".")}: ${err.message}`);
        return res.status(400).json({
          error: "Query Validation Error",
          details: issues,
          requestId: req.requestId
        });
      }
      return res.status(400).json({ error: "Invalid query parameters", requestId: req.requestId });
    }
  };
}
