import express from "express";
import { create, detail, list, remove, update } from "../controllers/productController.js";

const router = express.Router();

router.get("/", list);
router.get("/:id", detail);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
