import express from "express";
import { listMaintenance } from "../services/maintenanceService.js";
import { listProducts } from "../services/productService.js";
import { listPurchaseOrders } from "../services/purchaseOrderService.js";
import { listWorkCenters } from "../services/workCenterService.js";

const router = express.Router();

router.get("/overview", (_req, res) => {
  const products = listProducts();
  const orders = listPurchaseOrders();
  const maintenance = listMaintenance();
  const workCenters = listWorkCenters();
  res.json({
    generatedAt: new Date().toISOString(),
    masterData: { products: products.length, workCenters: workCenters.length },
    purchasing: { orderCount: orders.length, openValue: orders.filter((order) => !["received", "cancelled"].includes(order.status)).reduce((total, order) => total + order.total, 0) },
    maintenance: { scheduled: maintenance.filter((record) => record.status === "scheduled").length, urgent: maintenance.filter((record) => ["high", "critical"].includes(record.priority)).length },
    capacity: { workCenters: workCenters.map((workCenter) => ({ id: workCenter.id, name: workCenter.name, dailyCapacityHours: workCenter.dailyCapacityHours })) }
  });
});

export default router;
