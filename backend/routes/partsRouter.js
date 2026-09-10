import express from "express";
import { listProducts } from "../services/productService.js";
import { authenticate } from "../middleware/auth.js";
import { isUsPerson } from "../middleware/itarAccess.js";
import { recordComplianceAudit } from "../services/complianceAuditService.js";

const router = express.Router();

router.use(authenticate);

router.get("/", async (req, res) => {
  const products = listProducts();
  const visibleProducts = isUsPerson(req.user) ? products : products.filter((product) => !product.is_itar_controlled);
  const itarProducts = products.filter((product) => product.is_itar_controlled);

  await Promise.all(itarProducts.map((product) => recordComplianceAudit({
    req,
    actionType: "VIEW",
    targetTable: "parts",
    targetRecordId: product.id,
    isItarControlled: true,
    decision: isUsPerson(req.user) ? "allowed" : "blocked",
    reason: isUsPerson(req.user) ? "US person listed ITAR part" : "Non-US person parts list filtered"
  })));

  res.json(visibleProducts.map(({ id, sku, description, is_itar_controlled }) => ({
    id,
    part_number: sku,
    description,
    is_itar_controlled: Boolean(is_itar_controlled)
  })));
});

export default router;