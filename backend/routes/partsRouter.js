import express from "express";
import { listProducts } from "../services/productService.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(listProducts().map(({ id, sku, description }) => ({
    id,
    part_number: sku,
    description
  })));
});

export default router;