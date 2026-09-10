import { Router } from "express";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { aiProposalReviewSchema, aiQuoteIntakeRequestSchema } from "../validators/schemas.js";
import { createAiQuoteDraftProposal, listAiQuoteDraftProposals, reviewAiQuoteDraftProposal } from "../services/aiIntakeService.js";

const router = Router();
const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

router.use(authenticate);

router.post("/quote-extraction", requireRoles("admin", "manager", "operator"), validateBody(aiQuoteIntakeRequestSchema), async (req, res, next) => {
  try {
    const proposal = await createAiQuoteDraftProposal(req.body, req);
    return res.status(201).json({ success: true, ...proposal });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(422).json({ success: false, error: "AI output failed deterministic validation", details: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`), requestId: req.requestId });
    }
    return next(error);
  }
});

router.get("/quote-proposals", requireRoles("admin", "manager", "operator"), async (_req, res, next) => {
  try {
    return res.json({ success: true, proposals: await listAiQuoteDraftProposals() });
  } catch (error) {
    return next(error);
  }
});

router.patch("/quote-proposals/:id/review", requireRoles("admin", "manager"), validateBody(aiProposalReviewSchema), async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "id must be a positive integer", requestId: req.requestId });
  try {
    const proposal = await reviewAiQuoteDraftProposal(id, req.body, req);
    if (!proposal) return res.status(404).json({ error: "AI quote proposal not found", requestId: req.requestId });
    return res.json({ success: true, proposal });
  } catch (error) {
    return next(error);
  }
});

export default router;
