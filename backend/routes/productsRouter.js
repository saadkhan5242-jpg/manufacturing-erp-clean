import express from "express";
import { create, detail, list, remove, update } from "../controllers/productController.js";
import { authenticate } from "../middleware/auth.js";
import { requireUsPersonForItarPayload, requireUsPersonForItarRecord } from "../middleware/itarAccess.js";
import { getProduct } from "../services/productService.js";

const router = express.Router();
const itarProductGuard = (actionType) => requireUsPersonForItarRecord({ targetTable: "products", actionType, loadRecord: (req) => getProduct(req.params.id) });

router.use(authenticate);
router.get("/", list);
router.get("/:id", itarProductGuard("VIEW"), detail);
router.post("/", requireUsPersonForItarPayload("products"), create);
router.put("/:id", itarProductGuard("MODIFY"), requireUsPersonForItarPayload("products"), update);
router.delete("/:id", itarProductGuard("DELETE"), remove);

export default router;
